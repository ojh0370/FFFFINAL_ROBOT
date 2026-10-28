import { Navigation, Loader2, CheckCircle, XCircle, Ban, AlertTriangle, SearchX, Clock } from "lucide-react";

// navStatus: idle | navigating | succeeded | failed | canceled | busy | not_found | invalid_request
const CFG = {
  navigating: {
    wrap: "bg-blue-50 border-blue-200 text-blue-700",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    title: "이동 중입니다",
    sub: "로봇이 목표 서가로 자율주행 중이에요. 잠시만 기다려주세요.",
  },
  succeeded: {
    wrap: "bg-green-50 border-green-200 text-green-700",
    icon: <CheckCircle className="w-4 h-4" />,
    title: "도착 완료!",
    sub: "로봇이 목표 위치에 도달했습니다.",
  },
  failed: {
    wrap: "bg-red-50 border-red-200 text-red-600",
    icon: <XCircle className="w-4 h-4" />,
    title: "이동 실패",
    sub: "경로를 찾지 못했거나 이동 중 문제가 발생했습니다.",
  },
  canceled: {
    wrap: "bg-gray-100 border-gray-200 text-gray-600",
    icon: <Ban className="w-4 h-4" />,
    title: "이동 취소됨",
    sub: "로봇 이동이 취소되었습니다.",
  },
  busy: {
    wrap: "bg-amber-50 border-amber-200 text-amber-700",
    icon: <Clock className="w-4 h-4" />,
    title: "로봇이 다른 이동 중",
    sub: "로봇이 이미 안내 중입니다. 이동이 끝난 뒤 다시 시도해주세요.",
  },
  not_found: {
    wrap: "bg-red-50 border-red-200 text-red-600",
    icon: <SearchX className="w-4 h-4" />,
    title: "좌표를 찾을 수 없음",
    sub: "로봇의 DB에 이 책의 좌표가 없습니다.",
  },
  invalid_request: {
    wrap: "bg-red-50 border-red-200 text-red-600",
    icon: <AlertTriangle className="w-4 h-4" />,
    title: "잘못된 요청",
    sub: "요청 형식이 올바르지 않습니다.",
  },
};

export default function NavStatusView({ status, bookId }) {
  if (!status || status === "idle") return null;
  const c = CFG[status];
  if (!c) return null;

  // 응답의 book_id가 현재 요청과 다르면 무시(과거 요청의 잔류 응답 차단)
  const idLabel = bookId ? ` · ID ${bookId}` : "";

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${c.wrap}`}>
      <span className="mt-0.5 shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/60">
        {c.icon}
      </span>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Navigation className="w-3.5 h-3.5" />
          {c.title}{idLabel}
        </div>
        <p className="text-xs mt-0.5 opacity-80">{c.sub}</p>
      </div>
    </div>
  );
}