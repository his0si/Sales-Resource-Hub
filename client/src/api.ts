// 백엔드(FastAPI) 베이스 URL. 운영에서는 같은 도메인의 /api 를 쓰므로 빈 문자열,
// 로컬 개발에서는 http://localhost:8000 으로 폴백.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    // ...options 를 먼저 펼치고 headers 를 마지막에 둬야 Content-Type 이
    // options.headers(Authorization 등)에 덮이지 않는다.
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(parseDetail((data as { detail?: unknown }).detail, res.status));
  }
  return data as T;
}

// FastAPI 의 detail 은 문자열(HTTPException) 또는 검증오류 배열([{msg,...}]) 둘 다 가능.
// 배열이면 사람이 읽을 수 있는 메시지로 합쳐 "[object Object]" 노출을 막는다.
function parseDetail(detail: unknown, status: number): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((e) => (e && typeof e === "object" && "msg" in e ? String((e as { msg: unknown }).msg) : ""))
      .filter(Boolean);
    if (msgs.length) return msgs.join(", ");
  }
  return `요청 실패 (${status})`;
}

export function getHealth(): Promise<{ status: string }> {
  return request("/api/health");
}

export function getAuthConfig(): Promise<{ allowed_domains: string[]; departments: string[] }> {
  return request("/api/auth/config");
}

export function register(
  email: string,
  password: string,
  name?: string,
  department?: string,
): Promise<{ message: string }> {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name, department }),
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
  name: string | null;
  department: string | null;
  created_at: string;
}

export function getMe(token: string): Promise<Me> {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function changePassword(
  token: string,
  current_password: string,
  new_password: string,
): Promise<{ message: string }> {
  return request("/api/auth/change-password", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password, new_password }),
  });
}

export function updateProfile(
  token: string,
  data: { name?: string; department?: string },
): Promise<Me> {
  return request("/api/auth/profile", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
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

// === 영업일지(sales_memo) — DB 에 적재된 메모를 최신순으로 조회 ===
// 들어온 [HSP SalesMemo] 메일은 서버 폴러가 DB 에 저장하므로 화면은 DB 만 본다.

export interface SalesMemo {
  id: number;
  visit_no: string;
  customer_name: string | null;
  customer_code: string | null;
  author_name: string | null;
  author_emp_no: string | null;
  planned_visit_date: string | null;
  visit_date: string | null;
  written_at: string | null;
  activity_plan: string | null;
  strategy: string | null;
  operation: string | null;
  product: string | null;
  personal: string | null;
  takeaway: string | null;
  followup_plan: string | null;
  gmail_id: string | null;
}

export interface SalesMemoResult {
  count: number;
  total: number;
  memos: SalesMemo[];
}

export function getSalesMemos(token: string, limit = 500): Promise<SalesMemoResult> {
  return request(`/api/sales-memo?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 단건 원문 조회 (보드 카드 "원문" 모달용)
export function getSalesMemo(token: string, id: number): Promise<SalesMemo> {
  return request(`/api/sales-memo/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 메모 1건의 3줄 AI 요약 (카드 펼침 "AI 개요")
export function getSalesMemoSummary(
  token: string,
  id: number,
): Promise<{ summary: string[]; cached: boolean }> {
  return request(`/api/sales-memo/${id}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// === 제품 카테고리(부서) — categories.json 기반 ===

export interface CategoriesResult {
  categories: string[];
  tree: Record<string, string[]>;
  my_department: string;
}

export function getCategories(token: string): Promise<CategoriesResult> {
  return request("/api/categories", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// === 세일즈 메모 보드 (부서 분류 + 해시태그) ===

export interface MemoBoardItem {
  id: number;
  title: string;
  dept: string | null;
  own: boolean;
  unread: boolean;
  author: string;
  date: string;
  tags: string[];
  summary: string[]; // 미리 생성된 3줄 AI 요약 (없으면 빈 배열)
  gmail_id: string | null;
}

export interface MemoBoardResult {
  count: number;
  my_department: string;
  departments: string[];
  items: MemoBoardItem[];
}

export function getSalesMemoBoard(
  token: string,
  dept?: string,
  limit = 500,
): Promise<MemoBoardResult> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (dept) params.set("dept", dept);
  return request(`/api/sales-memo/board?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// AI 위클리 브리핑 (백그라운드 사전생성분을 읽기만 함). dept 미지정 시 본인 부서.
export function getSalesMemoBriefing(
  token: string,
  dept?: string,
): Promise<{ briefing: string; generated_at: string | null; pending: boolean }> {
  const qs = dept ? `?dept=${encodeURIComponent(dept)}` : "";
  return request(`/api/sales-memo/briefing${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
