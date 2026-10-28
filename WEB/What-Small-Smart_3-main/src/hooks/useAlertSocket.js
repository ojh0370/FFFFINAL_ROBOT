import { useState, useEffect, useRef, useCallback } from "react";

// 추종자 이탈 경고 전용 WebSocket 주소 (/ros와 별개 채널)
const ALERTS_WS_URL = (() => {
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  return apiBase.replace(/^http/, "ws").replace(/\/$/, "") + "/alerts-ws";
})();

// 새 경고가 뜨면 이 시간(ms) 동안 "경고" 상태를 유지 (그 사이 새 경고가 오면 다시 연장)
const ALERT_ACTIVE_DURATION_MS = 10000;

export function useAlertSocket() {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const activeTimer = useRef(null);
  const [connStatus, setConnStatus] = useState("disconnected"); // disconnected | connecting | connected | error
  const [latestAlert, setLatestAlert] = useState(null); // { distance, createdAt }
  const [alertActive, setAlertActive] = useState(false);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;
    setConnStatus("connecting");
    ws.current = new WebSocket(ALERTS_WS_URL);

    ws.current.onopen = () => {
      console.log("[alert] WebSocket 연결됨:", ALERTS_WS_URL);
      setConnStatus("connected");
    };
    ws.current.onerror = (e) => {
      console.error("[alert] WebSocket 에러:", ALERTS_WS_URL, e);
      setConnStatus("error");
    };
    ws.current.onclose = () => {
      console.warn("[alert] WebSocket 연결 종료:", ALERTS_WS_URL);
      setConnStatus("disconnected");
      reconnectTimer.current = setTimeout(connect, 3000);
    };
    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "follower_alert") {
          console.log("[alert] 추종자 이탈 경고 수신:", msg);
          setLatestAlert({ distance: msg.distance, createdAt: msg.createdAt });
          setAlertActive(true);
          clearTimeout(activeTimer.current);
          activeTimer.current = setTimeout(() => setAlertActive(false), ALERT_ACTIVE_DURATION_MS);
        }
      } catch {/* ignore non-JSON */}
    };
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    clearTimeout(activeTimer.current);
    ws.current?.close();
    setConnStatus("disconnected");
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return { connStatus, latestAlert, alertActive };
}
