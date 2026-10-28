import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { useAlertSocket } from "../hooks/useAlertSocket";
import { useBuzzerAudio } from "../hooks/useBuzzerAudio";

// 어느 페이지에 있든(책 검색 중이어도) 추종자 이탈 경고를 놓치지 않도록 화면 상단에 띄우는 전역 배너
export default function GlobalAlertToast() {
  const { latestAlert, alertActive } = useAlertSocket();
  const { playAlertSound } = useBuzzerAudio();
  const lastSeenAt = useRef(null);

  useEffect(() => {
    if (!latestAlert?.createdAt) return;
    if (lastSeenAt.current === latestAlert.createdAt) return;
    lastSeenAt.current = latestAlert.createdAt;
    playAlertSound();
  }, [latestAlert, playAlertSound]);

  if (!alertActive || !latestAlert) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-red-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="text-sm font-semibold">
        ⚠️ 추종자 이탈 감지! ({latestAlert.distance?.toFixed?.(1) ?? latestAlert.distance}cm) 로봇이 정지했어요
      </span>
    </div>
  );
}
