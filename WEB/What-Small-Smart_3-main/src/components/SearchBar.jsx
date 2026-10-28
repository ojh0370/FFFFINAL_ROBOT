import { useState, useCallback } from "react";
import { Search, Mic, Loader2 } from "lucide-react";
import { useVoiceSearch } from "../hooks/useVoiceSearch";

export default function SearchBar({ onSearch }) {
  const [value, setValue] = useState("");

  const { listening, processing, error, supported, start } = useVoiceSearch();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) onSearch(value.trim());
  };

  const handleMicClick = useCallback(() => {
    start((keyword) => {
      if (!keyword) return;
      setValue(keyword);
      onSearch(keyword);
    });
  }, [start, onSearch]);

  const busy = listening || processing;

  return (
    <div className="space-y-2">
      <form onSubmit={handleSubmit} className="relative">
        <div className="flex items-center bg-card border border-border rounded-2xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-accent-gold/40 focus-within:border-accent-gold transition-all">
          <Search className="w-5 h-5 text-muted-foreground ml-4 shrink-0" />
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={listening ? "듣고 있어요..." : "책 제목, 저자, 청구기호 입력..."}
            className="flex-1 bg-transparent px-4 py-4 text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {supported && (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={busy}
              className={`p-2.5 mx-1 rounded-xl transition-colors ${
                listening
                  ? "bg-red-50 text-red-500 animate-pulse"
                  : "text-muted-foreground hover:bg-muted"
              } disabled:opacity-60`}
              title={listening ? "듣는 중..." : "음성으로 검색"}
            >
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}
          <button
            type="submit"
            disabled={!value.trim()}
            className="m-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            검색
          </button>
        </div>
      </form>
      {listening && (
        <p className="text-xs text-accent-gold font-medium px-2">🎤 말씀하세요...</p>
      )}
      {processing && (
        <p className="text-xs text-muted-foreground px-2">키워드를 분석하고 있어요...</p>
      )}
      {error && <p className="text-xs text-red-500 px-2">{error}</p>}
    </div>
  );
}
