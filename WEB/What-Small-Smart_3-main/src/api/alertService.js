// 추종자 이탈 경고 이력 API
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://what-small-smart-3-1.onrender.com';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const alertService = {
  // GET /alerts?limit=30
  list: (limit = 30) => request(`/alerts?limit=${limit}`),
};
