// 백엔드(FastAPI) 베이스 URL. 운영에서는 같은 도메인의 /api 를 쓰므로 빈 문자열,
// 로컬 개발에서는 http://localhost:8000 으로 폴백.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail;
    throw new Error(detail ?? `요청 실패 (${res.status})`);
  }
  return data as T;
}

export function getHealth(): Promise<{ status: string }> {
  return request("/api/health");
}

export function getAuthConfig(): Promise<{ allowed_domains: string[] }> {
  return request("/api/auth/config");
}

export function register(email: string, password: string): Promise<{ message: string }> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface LoginResult {
  access_token: string;
  token_type: string;
  email: string;
}

export function login(email: string, password: string): Promise<LoginResult> {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export interface Me {
  id: number;
  email: string;
  is_verified: boolean;
  created_at: string;
}

export function getMe(token: string): Promise<Me> {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// === Gmail (ai.hansolhomedeco@gmail.com 공용 메일함, 로그인한 사용자 누구나 열람) ===

export interface MailItem {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
}

export interface InboxResult {
  mailbox: string;
  count: number;
  messages: MailItem[];
}

export function getInbox(token: string, maxResults = 15): Promise<InboxResult> {
  return request(`/api/gmail/inbox?max_results=${maxResults}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// Gmail users.messages.get(format=full) 원본 구조 (필요한 필드만 느슨하게 정의)
export interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}
export interface GmailMessage {
  id: string;
  snippet?: string;
  payload?: GmailPart;
}

export function getMessage(token: string, id: string): Promise<GmailMessage> {
  return request(`/api/gmail/messages/${id}?fmt=full`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
