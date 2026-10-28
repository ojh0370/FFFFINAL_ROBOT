import { useState } from "react";
import { Link } from "react-router-dom";
import SearchBar from "../components/SearchBar";
import BookCard from "../components/BookCard";
import BookDetail from "../components/BookDetail";
import { bookService } from "../api/bookService";
import { BookOpen, Bot, ShieldAlert } from "lucide-react";

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const handleSearch = async (q) => {
    setLoading(true);
    setSearched(true);
    setSelectedBook(null);
    const results = await bookService.search(q);
    setResults(results);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-5 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent-gold rounded-lg flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">먹똑</h1>
            <p className="text-xs text-primary-foreground/60 mt-0.5">도서관 안내 로봇</p>
          </div>
        </div>
        <Link
          to="/buzzer"
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          title="추종 안전 모니터"
        >
          <ShieldAlert className="w-4 h-4" />
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        {!searched && (
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-accent-gold/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <BookOpen className="w-10 h-10 text-accent-gold" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">어떤 책을 찾고 계신가요?</h2>
            <p className="text-muted-foreground text-sm">제목, 저자, 청구기호로 검색하세요</p>
          </div>
        )}

        <SearchBar onSearch={handleSearch} />

        {/* Results */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-3 border-border border-t-accent-gold rounded-full animate-spin" />
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-foreground font-medium">검색 결과가 없습니다</p>
            <p className="text-muted-foreground text-sm mt-1">다른 검색어로 시도해보세요</p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground font-medium">{results.length}권의 도서를 찾았습니다</p>
            {results.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onClick={() => setSelectedBook(book)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedBook && (
        <BookDetail book={selectedBook} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
}