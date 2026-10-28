# 먹똑 로컬 서버

도서 검색 API(`/books`)와 rosbridge WebSocket 브릿지(`/ros`)를 함께 제공하는 Node 서버입니다.
Codespace 로컬 환경에서 실행하면 프론트엔드 하나만 바라보면 도서 데이터와 로봇 연결을 모두 사용할 수 있습니다.

## 폴더 구조

```
server/
  index.js        # Express 도서 API + ws rosbridge 브릿지
  books.json      # 샘플 도서 데이터
  package.json    # 서버 의존성(express, ws)
```

## 실행 방법

```bash
cd server
npm install
npm start
# 개발(파일 변경 시 자동 재시작): npm run dev
```

실행되면:

- 도서 API  → `http://localhost:3000/books`
- 로봇 브릿지 → `ws://localhost:3000/ros`

## 환경 변수 (서버 측)

| 변수             | 기본값                  | 설명                              |
| ---------------- | ----------------------- | --------------------------------- |
| `PORT`           | `3000`                  | 서버 HTTP/WS 포트                  |
| `ROSBRIDGE_URL`  | `ws://localhost:9090`   | 연결할 rosbridge WebSocket 주소    |

예 (실제 로봇이 라즈베리파이 192.168.0.50):
```bash
ROSBRIDGE_URL=ws://192.168.0.50:9090 npm start
```

## 프론트엔드와 연동

프로젝트 루트 `.env` 에서:

```
VITE_API_BASE_URL=http://localhost:3000
```

로 설정하면 `useRosbridge.js`가 `ws://localhost:3000/ros` 로 자동 파생합니다.
도서 API와 로봇 연결 모두 포트 3000 하나로 통합되므로 Codespace에서 포트 하나만 포워딩하면 됩니다.

## 동작 흐름

1. 프론트엔드 → `GET /books?search=...` (도서 검색)
2. 사용자가 "로봇으로 안내받기" 클릭
3. 프론트엔드 → `ws://...3000/ros` (브릿지 연결) → `publish /app/book_request`
4. 서버가 rosbridge(ROSBRIDGE_URL)로 메시지 투명 전달
5. 로봇이 `/app/nav_status` publish → 서버 → 프론트엔드로 전달