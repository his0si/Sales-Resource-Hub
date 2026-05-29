// 백엔드(FastAPI) 베이스 URL. 필요하면 .env 의 VITE_API_URL 로 덮어쓸 수 있습니다.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function getHealth(): Promise<{ status: string }> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
