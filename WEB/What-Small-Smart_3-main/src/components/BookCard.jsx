import { MapPin, User, BookMarked, CheckCircle, XCircle } from "lucide-react";

export default function BookCard({ book, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl p-4 hover:border-accent-gold/50 hover:shadow-md transition-all group"
    >
      <div className="flex gap-4">
        {/* Cover placeholder */}
        <div className="w-14 h-20 bg-gradient-to-br from-primary/10 to-accent-gold/20 rounded-lg shrink-0 flex items-center justify-center">
          <BookMarked className="w-6 h-6 text-accent-gold" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2 group-hover:text-accent-gold transition-colors">
              {book.title}
            </h3>
            {book.is_available !== false ? (
              <span className="shrink-0 flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" /> 대출가능
              </span>
            ) : (
              <span className="shrink-0 flex items-center gap-1 text-xs text-red-500 font-medium bg-red-50 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3" /> 대출중
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <User className="w-3 h-3" /> {book.author}
            {book.publisher && <span className="text-border">·</span>}
            {book.publisher && <span>{book.publisher}</span>}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-md font-mono">
              {book.call_number}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 text-accent-gold" />
              {book.floor}층 · {book.shelf_section} {book.shelf_number}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}