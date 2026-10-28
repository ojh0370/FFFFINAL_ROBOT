// 개인 Node.js 서버 URL 설정
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://what-small-smart-3.onrender.com';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const bookService = {
  // GET /books
  list: () => request("/books"),

  // GET /books?search=keyword
  search: (query) => request(`/books?search=${encodeURIComponent(query)}`),

  // GET /books/:id
  get: (id) => request(`/books/${id}`),
};