import { ShieldCheck, ShieldAlert, Wifi, WifiOff } from "lucide-react";

export default function StatusBar({ connStatus, alertActive, latestAlert }) {
  const online = connStatus === "connected";

  return (
    <div
      className={`rounded-2xl p-6 text-center border-2 transition-colors ${
        alertActive ? "bg-red-50 border-red-300" : "bg-green-50 border-green-200"
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 mb-2">
        {online ? (
          <Wifi className="w-3.5 h-3.5 text-green-600" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-gray-400" />
        )}
        <span className="text-xs text-muted-foreground">
          {online ? "실시간 모니터링 중" : "연결 끊김 - 재연결 시도 중..."}
        </span>
      </div>

      {alertActive ? (
        <>
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-2 animate-pulse" />
          <p className="text-xl font-bold text-red-600">⚠️ 추종자 이탈 경고</p>
          {latestAlert && (
            <p className="text-sm text-red-500 mt-1">
              감지 거리: {latestAlert.distance?.toFixed?.(1) ?? latestAlert.distance}cm
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">로봇이 안전을 위해 정지했어요</p>
        </>
      ) : (
        <>
          <ShieldCheck className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-xl font-bold text-green-700">정상 - 추종 중</p>
        </>
      )}
    </div>
  );
}
