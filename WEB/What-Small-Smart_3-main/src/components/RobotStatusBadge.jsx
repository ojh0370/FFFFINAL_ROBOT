export default function RobotStatusBadge({ status }) {
  const config = {
    connected:    { color: "bg-green-100 text-green-700", dot: "bg-green-500", label: "로봇 연결됨" },
    connecting:   { color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400 animate-pulse", label: "연결 중..." },
    disconnected: { color: "bg-gray-100 text-gray-500", dot: "bg-gray-400", label: "로봇 미연결" },
    error:        { color: "bg-red-100 text-red-600", dot: "bg-red-500", label: "연결 오류" },
    // 서버(Render)까지는 연결됐지만 서버↔로봇(ngrok/rosbridge) 구간이 끊긴 상태
    server_only:  { color: "bg-orange-100 text-orange-600", dot: "bg-orange-400 animate-pulse", label: "서버만 연결됨 (로봇 미연결)" },
  };
  const c = config[status] || config.disconnected;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}