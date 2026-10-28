import { useState } from "react";
import { X, MapPin, BookMarked, User, Building2, Hash, Navigation, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRosbridge } from "../hooks/useRosbridge";
import RobotStatusBadge from "./RobotStatusBadge";
import NavStatusView from "./NavStatusView";

export default function BookDetail({ book, onClose }) {
  const { connStatus, robotConnected, navStatus, navBookId, sendBookRequest, resetNavStatus } = useRosbridge();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const bookId = String(book.book_id || book.id);

  // 배지에 실제 상태를 반영: 서버(connStatus)는 붙었는데 로봇(robotConnected)이 안 붙었으면 별도 표시
  const badgeStatus =
    connStatus === "connected" && !robotConnected ? "server_only" : connStatus;
  const trulyConnected = connStatus === "connected" && robotConnected;

  const handleGuide = () => {
    setError(null);
    resetNavStatus();

    if (!trulyConnected) {
      setError(
        connStatus !== "connected"
          ? "서버와 연결되지 않았습니다. 같은 Wi-Fi인지 확인해주세요."
          : "서버는 연결됐지만 로봇(rosbridge)과 연결되지 않았어요. ngrok/rosbridge 상태를 확인해주세요."
      );
      return;
    }

    setSending(true);
    try {
      sendBookRequest(bookId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const busy = navStatus === "navigating" || sending;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          <div className="flex items-start justify-between px-6 pt-4 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {book.is_available !== false ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-semibold bg-green-50 px-3 py-1 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> 대출 가능
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-500 font-semibold bg-red-50 px-3 py-1 rounded-full">
                  <XCircle className="w-3.5 h-3.5" /> 대출 중
                </span>
              )}
              <RobotStatusBadge status={badgeStatus} />
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="px-6 pb-2">
            <div className="flex gap-4">
              <div className="w-20 h-28 bg-gradient-to-br from-primary/10 to-accent-gold/20 rounded-xl shrink-0 flex items-center justify-center shadow-sm">
                <BookMarked className="w-8 h-8 text-accent-gold" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground leading-tight">{book.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> {book.author}
                </p>
                {book.publisher && (
                  <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5" /> {book.publisher}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 font-mono flex items-center gap-1">
                  <Hash className="w-3 h-3" /> {book.call_number}
                </p>
              </div>
            </div>
          </div>

          <div className="mx-6 my-4 bg-accent-gold/5 border border-accent-gold/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-accent-gold" />
              <span className="text-sm font-bold text-foreground">도서 위치</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <p className="text-xs text-muted-foreground mb-1">층</p>
                <p className="text-xl font-bold text-foreground">{book.floor}<span className="text-sm font-normal">층</span></p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <p className="text-xs text-muted-foreground mb-1">구역</p>
                <p className="text-xl font-bold text-foreground">{book.shelf_section}</p>
              </div>
              <div className="bg-card rounded-xl p-3 text-center border border-border">
                <p className="text-xs text-muted-foreground mb-1">서가</p>
                <p className="text-xl font-bold text-foreground">{book.shelf_number || "-"}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 bg-primary/5 rounded-xl px-3 py-2">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs text-muted-foreground font-mono truncate">
                Book ID: {bookId}
              </span>
            </div>
          </div>

          {book.description && (
            <div className="px-6 pb-2">
              <p className="text-sm text-muted-foreground leading-relaxed">{book.description}</p>
            </div>
          )}

          <div className="px-6 pb-8 pt-2 space-y-2">
            <NavStatusView status={navStatus} bookId={navBookId} />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600 text-center">
                ⚠️ {error}
              </div>
            )}

            <button
              onClick={handleGuide}
              disabled={busy || !trulyConnected}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {busy ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 전송 중...</>
              ) : navStatus === "succeeded" ? (
                <><CheckCircle className="w-4 h-4" /> 다시 안내받기</>
              ) : (
                <><Navigation className="w-4 h-4" /> 로봇으로 안내받기</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}