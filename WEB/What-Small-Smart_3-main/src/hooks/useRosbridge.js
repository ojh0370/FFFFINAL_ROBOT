import { useState, useEffect, useRef, useCallback } from "react";

// 로봇(rosbridge) 연결용 WebSocket 주소.
// 1) VITE_ROS_WS_URL 직접 지정 → 해당 주소로 연결 (예: 직접 rosbridge ws://192.168.x.x:9090)
// 2) 미지정 → VITE_API_BASE_URL(http→ws 변환)/ros 자동 파생 (로컬 Node 서버의 /ros 브릿지)
const ROS_WS_URL = (() => {
  const explicit = import.meta.env.VITE_ROS_WS_URL;
  if (explicit) return explicit;
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  return apiBase.replace(/^http/, "ws").replace(/\/$/, "") + "/ros";
})();
console.log("[rosbridge] 연결 대상 URL:", ROS_WS_URL, "| VITE_API_BASE_URL:", import.meta.env.VITE_API_BASE_URL);

// /app/nav_status 에서 오는 상태 코드 목록
const VALID_STATUSES = ["idle", "navigating", "succeeded", "failed", "canceled", "busy", "not_found", "invalid_request"];

export function useRosbridge() {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const subscribed = useRef(false);
  const [connStatus, setConnStatus] = useState("disconnected"); // disconnected | connecting | connected | error
  // Render 서버 자체가 아니라 "서버 -> rosbridge(ngrok) -> 로봇"까지 실제로 붙었는지 여부
  const [robotConnected, setRobotConnected] = useState(false);
  // 로봇이 보낸 상태: idle | navigating | succeeded | failed | canceled | busy | not_found | invalid_request
  const [navStatus, setNavStatus] = useState("idle");
  // 상태 문자열에 포함된 book_id (예: "navigating:0001" → "0001")
  const [navBookId, setNavBookId] = useState("");
  // 마지막 요청한 book_id (응답 매칭용)
  const requestBookId = useRef("");
  // 요청 후 일정 시간 응답이 없으면 자동으로 실패 처리하기 위한 타이머
  const navTimeoutTimer = useRef(null);
  const NAV_TIMEOUT_MS = 20000; // 20초 안에 로봇 응답 없으면 실패 처리

  const clearNavTimeout = useCallback(() => {
    if (navTimeoutTimer.current) {
      clearTimeout(navTimeoutTimer.current);
      navTimeoutTimer.current = null;
    }
  }, []);

  const send = useCallback((obj) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(obj));
    }
  }, []);

  const subscribeStatus = useCallback(() => {
    if (subscribed.current) return;
    subscribed.current = true;
    send({
      op: "subscribe",
      topic: "/app/nav_status",
      type: "std_msgs/msg/String",
    });
  }, [send]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    setConnStatus("connecting");
    ws.current = new WebSocket(ROS_WS_URL);

    ws.current.onopen = () => {
      console.log("[rosbridge] WebSocket 연결됨:", ROS_WS_URL);
      setConnStatus("connected");
      subscribeStatus();
    };
    ws.current.onerror = (e) => {
      console.error("[rosbridge] WebSocket 에러:", ROS_WS_URL, e);
      setConnStatus("error");
    };
    ws.current.onclose = () => {
      console.warn("[rosbridge] WebSocket 연결 종료:", ROS_WS_URL);
      setConnStatus("disconnected");
      setRobotConnected(false);
      subscribed.current = false;
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // 서버가 보내는 "rosbridge(ngrok) 실제 연결 여부" 메시지
        if (msg.type === "bridge_status") {
          console.log("[rosbridge] 서버↔로봇 브릿지 상태:", msg.connected);
          setRobotConnected(!!msg.connected);
          return;
        }

        console.log("[rosbridge] 메시지 수신:", msg.op, msg.topic, msg.msg?.data);
        if ((msg.op === "topic" || msg.op === "publish") && msg.topic === "/app/nav_status") {
          const raw = (msg.msg?.data || "").trim();
          // "navigating:0001" → status, book_id 분리
          const [code, bookId] = raw.split(":");
          if (VALID_STATUSES.includes(code)) {
            clearNavTimeout(); // 실제 응답이 왔으니 타임아웃 취소
            setNavStatus(code);
            setNavBookId(bookId || "");
          }
        }
      } catch {/* ignore non-JSON */}
    };
  }, [subscribeStatus, clearNavTimeout]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    subscribed.current = false;
    ws.current?.close();
    setConnStatus("disconnected");
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  /**
   * 앱 -> rosbridge -> /app/book_request (std_msgs/String)
   * 책의 ID(문자열)만 전송. 좌표는 로봇 측 JSON에서 book_id 키로 찾음.
   */
  const sendBookRequest = useCallback((bookId) => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      throw new Error("서버와 연결되지 않았습니다.");
    }
    if (!robotConnected) {
      // Render 서버까지는 붙어있어도 로봇(rosbridge)까지는 안 붙어있는 상태
      throw new Error("로봇이 아직 연결되지 않았습니다. ngrok/rosbridge 상태를 확인해주세요.");
    }
    const id = String(bookId);
    requestBookId.current = id;
    // 낙관적 UX (브리지가 곧 navigating:<id> publish)
    setNavStatus("navigating");
    setNavBookId(id);

    send({
      op: "publish",
      topic: "/app/book_request",
      type: "std_msgs/msg/String",
      msg: { data: id },
    });

    // 일정 시간 안에 로봇 쪽 응답(succeeded/failed/not_found 등)이 없으면 자동으로 실패 처리
    clearNavTimeout();
    navTimeoutTimer.current = setTimeout(() => {
      setNavStatus((prev) => (prev === "navigating" ? "failed" : prev));
    }, NAV_TIMEOUT_MS);
  }, [send, robotConnected, clearNavTimeout]);

  const resetNavStatus = useCallback(() => {
    clearNavTimeout();
    setNavStatus("idle");
    setNavBookId("");
    requestBookId.current = "";
  }, [clearNavTimeout]);

  useEffect(() => () => clearNavTimeout(), [clearNavTimeout]);

  return {
    connStatus,       // Render 서버와의 연결 상태
    robotConnected,   // 실제 로봇(rosbridge)까지 연결됐는지
    navStatus,
    navBookId,
    sendBookRequest,
    resetNavStatus,
    connect,
    disconnect,
  };
}