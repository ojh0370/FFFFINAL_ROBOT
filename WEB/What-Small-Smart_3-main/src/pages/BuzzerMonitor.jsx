import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAlertSocket } from "../hooks/useAlertSocket";
import { useBuzzerAudio } from "../hooks/useBuzzerAudio";
import { alertService } from "../api/alertService";
import StatusBar from "../components/buzzer/StatusBar";
import AlertHistory from "../components/buzzer/AlertHistory";

export default function BuzzerMonitor() {
  const { connStatus, latestAlert, alertActive } = useAlertSocket();
  const { playAlertSound } = useBuzzerAudio();
  const [history, setHistory] = useState([]);
  const lastSeenAt = useRef(null);

  // 페이지 진입 시 최근 이력 불러오기
  useEffect(() => {
    alertService.list(30).then(setHistory).catch(() => {});
  }, []);

  // 새 경고가 실시간으로 들어오면 이력 맨 위에 추가 + 소리 재생
  useEffect(() => {
    if (!latestAlert?.createdAt) return;
    if (lastSeenAt.current === latestAlert.createdAt) return; // 같은 알림 중복 처리 방지
    lastSeenAt.current = latestAlert.createdAt;

    setHistory((prev) => [latestAlert, ...prev].slice(0, 50));
    playAlertSound();
  }, [latestAlert, playAlertSound]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-primary text-primary-foreground px-6 py-5 flex items-center gap-3 shadow-md">
        <Link
          to="/"
          className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-none">추종 안전 모니터</h1>
          <p className="text-xs text-primary-foreground/60 mt-0.5">
            로봇과의 거리를 실시간으로 확인해요
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <StatusBar connStatus={connStatus} alertActive={alertActive} latestAlert={latestAlert} />

        <div>
          <h2 className="text-sm font-bold text-foreground mb-3">최근 경고 이력</h2>
          <AlertHistory alerts={history} />
        </div>
      </main>
    </div>
  );
}
