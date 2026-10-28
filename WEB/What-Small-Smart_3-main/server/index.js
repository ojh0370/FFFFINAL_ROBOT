// 먹똑 로컬 서버 — 도서 API + rosbridge WebSocket 브릿지 + Groq AI 검색어 추출
// 실행: npm install && npm start  (또는) npm run dev
import express from "express";
import mongoose from "mongoose";
import { WebSocketServer, WebSocket } from "ws";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 설정 ──
const PORT = process.env.PORT || 3000;
const ROSBRIDGE_URL = process.env.ROSBRIDGE_URL || "wss://bargraph-plausibly-theology.ngrok-free.dev";
const MONGODB_URI = process.env.MONGODB_URI;

// ── GROQ 설정 ──
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const TRAILING_REQUEST_PATTERN = /\s?(찾아줘|검색해줘|알려줘|보여줘)[.!?~]*$/;

// ── 라즈베리파이(추종자 이탈 감지) 인증 ──
const PI_API_KEY = process.env.PI_API_KEY;

if (!MONGODB_URI) {
  console.error("에러: MONGODB_URI 환경 변수가 설정되지 않았습니다.");
  process.exit(1);
}

// ── MongoDB 스키마 ──
const bookSchema = new mongoose.Schema({
  id: Number,
  book_id: { type: String, unique: true },
  title: String,
  author: String,
  publisher: String,
  call_number: String,
  isbn: String,
  floor: Number,
  shelf_section: String,
  shelf_number: mongoose.Schema.Types.Mixed,
  is_available: Boolean,
  description: String,
});
const Book = mongoose.model("Book", bookSchema);

const robotStatusSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: "robot" },
  status: { type: String, default: "idle" },
  updatedAt: { type: Date, default: Date.now },
});
const RobotStatus = mongoose.model("RobotStatus", robotStatusSchema);

// 추종자 이탈 경고 이력
const alertLogSchema = new mongoose.Schema({
  distance: Number,
  createdAt: { type: Date, default: Date.now },
});
const AlertLog = mongoose.model("AlertLog", alertLogSchema);

async function seedBooksIfEmpty() {
  const count = await Book.countDocuments();
  if (count > 0) return;
  const seed = JSON.parse(readFileSync(join(__dirname, "books.json"), "utf-8"));
  await Book.insertMany(seed);
  console.log(`📚 초기 도서 데이터 ${seed.length}건 저장 완료`);
}

async function saveRobotStatus(statusText) {
  await RobotStatus.findOneAndUpdate(
    { key: "robot" },
    { status: statusText, updatedAt: new Date() },
    { upsert: true }
  );
}

const app = express();

// ── 미들웨어 설정 ──
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"); // POST 허용 추가
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// JSON Body 파싱 (반드시 라우트 앞에 위치)
app.use(express.json());

// ── HTTP 라우트 ──

// GET /books
app.get("/books", async (req, res) => {
  const q = (req.query.search || "").toString().trim();
  const filter = q
    ? {
        $or: [
          { title: { $regex: q, $options: "i" } },
          { author: { $regex: q, $options: "i" } },
          { call_number: { $regex: q, $options: "i" } },
          { isbn: { $regex: q, $options: "i" } },
        ],
      }
    : {};
  const books = await Book.find(filter).lean();
  res.json(books);
});

// GET /books/:id
app.get("/books/:id", async (req, res) => {
  const id = req.params.id;
  const book = await Book.findOne({ $or: [{ book_id: id }, { id: Number(id) || -1 }] }).lean();
  if (!book) return res.status(404).json({ error: "not_found" });
  res.json(book);
});

// GET /robot-status
app.get("/robot-status", async (req, res) => {
  const doc = await RobotStatus.findOne({ key: "robot" }).lean();
  res.json({ status: doc?.status || "idle" });
});

// POST /alert — 라즈베리파이(ESP32 초음파 센서)가 보내는 "추종자 이탈" 경고 수신
app.post("/alert", async (req, res) => {
  const { distance, api_key } = req.body || {};

  if (!PI_API_KEY) {
    console.error("에러: PI_API_KEY 환경 변수가 설정되지 않았습니다.");
    return res.status(500).json({ error: "server_not_configured" });
  }
  if (api_key !== PI_API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (typeof distance !== "number" || Number.isNaN(distance)) {
    return res.status(400).json({ error: "invalid_distance" });
  }

  await AlertLog.create({ distance });
  console.log(`🚨 추종자 이탈 경고 수신: ${distance.toFixed(1)}cm`);

  // 지금 웹사이트에 접속 중인 모든 프론트엔드에 실시간으로 알림 전달
  broadcastAlert({ type: "follower_alert", distance, createdAt: new Date().toISOString() });

  res.json({ ok: true });
});

// GET /alerts — 최근 경고 이력 (알림 히스토리 화면용)
app.get("/alerts", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const alerts = await AlertLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  res.json(alerts);
});

// POST /extract-keyword (음성 검색 키워드 추출)
app.post("/extract-keyword", async (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "text가 필요합니다." });
  }

  if (!GROQ_API_KEY) {
    const fallback = text.replace(TRAILING_REQUEST_PATTERN, "").trim();
    console.warn("GROQ_API_KEY 미설정 — 정규식 폴백만 사용");
    return res.json({ keyword: fallback, fallback: true });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        max_tokens: 20,
        messages: [
          {
            role: "system",
            content:
              "너는 도서관 검색어 추출기다. 사용자의 음성 입력에서 검색할 핵심 키워드(책 제목, 저자명, 주제어 등)만 뽑아 단답형으로 출력하라. " +
              "조사, 부가 설명, 문장부호, '찾아줘/검색해줘/알려줘' 같은 요청 표현은 모두 제거하라. " +
              "예시 입력: '해리포터 책 좀 찾아줘' → 출력: '해리포터'. " +
              "부가 설명이나 완성된 문장을 절대 덧붙이지 마라. 키워드만 출력하라.",
          },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!groqRes.ok) {
      throw new Error(`Groq API 응답 오류: ${groqRes.status}`);
    }

    const data = await groqRes.json();
    const keyword = data.choices?.[0]?.message?.content?.trim();

    if (!keyword) throw new Error("빈 응답");

    const cleaned = keyword.replace(/^["'“”]|["'“”.]$/g, "").trim();
    res.json({ keyword: cleaned });
  } catch (err) {
    clearTimeout(timer);
    console.warn("Groq 키워드 추출 실패, 정규식 폴백 사용:", err.message);
    const fallback = text.replace(TRAILING_REQUEST_PATTERN, "").trim();
    res.json({ keyword: fallback, fallback: true });
  }
});

// ── 서버 실행 및 WebSocket 프록시 ──
// 추종자 이탈 경고를 실시간으로 뿌려줄 전용 채널 (로봇 제어용 /ros 와는 별개)
const alertClients = new Set();

function broadcastAlert(payload) {
  const str = JSON.stringify(payload);
  for (const client of alertClients) {
    if (client.readyState === WebSocket.OPEN) client.send(str);
  }
}

async function startServer() {
  await mongoose.connect(MONGODB_URI);
  console.log("✅ MongoDB 연결 성공!");
  await seedBooksIfEmpty();

  const httpServer = app.listen(PORT, () => {
    console.log(`📚 도서 API  → http://localhost:${PORT}/books`);
    console.log(`🧠 AI 키워드 추출 API → POST http://localhost:${PORT}/extract-keyword`);
  });

  httpServer.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

  if (pathname === "/ros") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else if (pathname === "/alerts-ws") {
    wssAlerts.handleUpgrade(request, socket, head, (ws) => {
      wssAlerts.emit("connection", ws, request);
    });
  } else {
    // 경로가 일치하지 않으면 연결 파기 (400 에러 반환)
    socket.destroy();
  }
});

  const wss = new WebSocketServer({ noServer: true });

  wss.on("connection", (clientSocket) => {
    console.log("🔗 프론트엔드가 /ros 에 연결됨");

    let rosSocket = null;
    const buffer = [];
    let closed = false;

    // rosbridge(ngrok) 실제 연결 상태를 프론트엔드에 별도 메시지로 알림.
    // 프론트는 이 메시지로 "Render 서버 연결"과 "로봇(rosbridge) 연결"을 구분해서 표시함.
    const sendBridgeStatus = (connected) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(JSON.stringify({ type: "bridge_status", connected }));
      }
    };

    const connectRos = () => {
      console.log(`rosbridge 연결 시도: ${ROSBRIDGE_URL}`);
      rosSocket = new WebSocket(ROSBRIDGE_URL);

      rosSocket.on("open", () => {
        console.log("✅ rosbridge 연결됨 — 버퍼 전송");
        sendBridgeStatus(true);
        while (buffer.length) rosSocket.send(buffer.shift());
      });

      rosSocket.on("message", (data) => {
        const str = data.toString();
        try {
          const parsed = JSON.parse(str);
          console.log(`[rosbridge→서버] op=${parsed.op} topic=${parsed.topic} data=${parsed.msg?.data || ""}`);
          if ((parsed.op === "topic" || parsed.op === "publish") && parsed.topic === "/app/nav_status") {
            const statusText = parsed.msg?.data;
            if (statusText) saveRobotStatus(statusText);
          }
        } catch {/* ignore */}

        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(str);
        }
      });

      rosSocket.on("close", () => {
        rosSocket = null;
        sendBridgeStatus(false);
        if (closed) return;
        console.warn("rosbridge 연결 종료 — 3초 후 재시도");
        setTimeout(connectRos, 3000);
      });

      rosSocket.on("error", () => { /* close에서 처리 */ });
    };
    // 클라이언트가 붙자마자 현재는 아직 rosbridge 연결 전이므로 false로 먼저 알림
    sendBridgeStatus(false);
    connectRos();

    clientSocket.on("message", (data) => {
          const str = data.toString();
          try {
        const parsed = JSON.parse(str);
            console.log(`[프론트→rosbridge] op=${parsed.op} topic=${parsed.topic} data=${parsed.msg?.data || ""}`);
          } catch {/* ignore */}

          if (rosSocket && rosSocket.readyState === WebSocket.OPEN) {
            rosSocket.send(str);
          } else if (rosSocket && rosSocket.readyState === WebSocket.CONNECTING) {
            buffer.push(str);
          }
    });

    clientSocket.on("close", () => {
      closed = true;
      console.log("프론트엔드 연결 해제");
      rosSocket?.close();
    });
  });

  // 추종자 이탈 경고 전용 WebSocket (/alerts-ws) — 로봇 제어(/ros)와 완전히 분리된 채널
  const wssAlerts = new WebSocketServer({ noServer: true });
  wssAlerts.on("connection", (client) => {
    console.log("🔔 프론트엔드가 /alerts-ws 에 연결됨");
    alertClients.add(client);
    client.on("close", () => {
      alertClients.delete(client);
      console.log("🔔 /alerts-ws 연결 해제");
    });
  });

  console.log(`🤖 rosbridge 대상: ${ROSBRIDGE_URL}`);
}

startServer().catch((err) => {
  console.error("서버 시작 실패:", err);
  process.exit(1);
});