
import { useState } from "react";
import { useRosbridge } from "../hooks/useRosbridge";

export default function AdminRobot() {
  const {
    connStatus,
    robotConnected,
    navStatus,
    navBookId,
    sendBookRequest,
    resetNavStatus,
  } = useRosbridge();

  const [message, setMessage] = useState("");

  const handleReturnHome = () => {
    if (connStatus !== "connected" || !robotConnected) {
      setMessage("로봇 연결 상태를 확인해주세요.");
      return;
    }

    if (navStatus === "navigating" || navStatus === "busy") {
      setMessage("로봇이 이동 중입니다. 잠시 기다려주세요.");
      return;
    }

    const confirmed = window.confirm(
      "로봇을 지정된 복귀 위치로 이동할까요?"
    );

    if (!confirmed) return;

    try {
      resetNavStatus();
      sendBookRequest("0000");
      setMessage("복귀 명령을 전송했습니다.");
    } catch (error) {
      setMessage(error.message || "복귀 명령 전송에 실패했습니다.");
    }
  };

  const connectionText =
    connStatus !== "connected"
      ? "서버 연결 안 됨"
      : robotConnected
        ? "로봇 연결됨"
        : "로봇 연결 대기 중";

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-lg rounded-2xl bg-white p-6 shadow">
        <h1 className="mb-2 text-2xl font-bold">
          로봇 관리자
        </h1>

        <p className="mb-6 text-sm text-gray-600">
          로봇 상태를 확인하고 복귀 명령을 보낼 수 있습니다.
        </p>

        <div className="mb-6 rounded-lg bg-gray-100 p-4">
          <p className="font-semibold">연결 상태</p>
          <p>{connectionText}</p>

          <p className="mt-3 font-semibold">이동 상태</p>
          <p>{navStatus}</p>

          {navBookId && (
            <p className="mt-1 text-sm text-gray-600">
              요청 ID: {navBookId}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleReturnHome}
          disabled={
            !robotConnected ||
            connStatus !== "connected" ||
            navStatus === "navigating" ||
            navStatus === "busy"
          }
          className="w-full rounded-xl bg-blue-600 px-5 py-4
            font-bold text-white transition hover:bg-blue-700
            disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          홈으로 복귀
        </button>

        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-gray-100 p-3 text-sm"
          >
            {message}
          </p>
        )}
      </div>
    </main>
  );
}
