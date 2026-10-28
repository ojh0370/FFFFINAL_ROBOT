import { AlertTriangle } from "lucide-react";

export default function AlertHistory({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        아직 기록된 경고가 없어요.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div
          key={a._id || `${a.createdAt}-${i}`}
          className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm font-medium text-foreground">
              {(a.distance?.toFixed?.(1) ?? a.distance)}cm 이탈 감지
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {new Date(a.createdAt).toLocaleString("ko-KR")}
          </span>
        </div>
      ))}
    </div>
  );
}
