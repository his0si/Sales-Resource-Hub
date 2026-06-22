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
  customer: string | null;
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
  limit = 2000,
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

// === 뉴스(working_news_articles) — 수집·분류 파이프라인 결과를 읽기만 함 ===

export interface NewsArticle {
  id: number;
  company: string; // search_query 로 유도한 회사명(주제성 기사는 '기타')
  title: string | null;
  description: string | null;
  link: string | null; // 원문 링크(originallink 우선, 없으면 naverlink)
  types: string[]; // 유형: primary(+secondary). 1~2개
  confidence: number | null;
  collected_at: string | null; // '마지막 업데이트' = 수집 시각(KST)
  published_at: string | null;
}

export interface NewsFacet {
  name: string;
  count: number;
}

export interface NewsResult {
  count: number;
  total: number;
  companies: NewsFacet[]; // 회사 필터 칩
  categories: NewsFacet[]; // 유형 필터 칩
  items: NewsArticle[];
}

export function getNews(
  token: string,
  opts: { company?: string; category?: string; q?: string; sort?: string; limit?: number } = {},
): Promise<NewsResult> {
  const params = new URLSearchParams();
  if (opts.company) params.set("company", opts.company);
  if (opts.category) params.set("category", opts.category);
  if (opts.q) params.set("q", opts.q);
  if (opts.sort) params.set("sort", opts.sort);
  params.set("limit", String(opts.limit ?? 1000));
  return request(`/api/news?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// 뉴스 AI 위클리 브리핑 (news_briefing) — 네 갈래 구조
export interface NewsBriefing {
  created_at: string | null;
  self_news: string | null; // 자사 뉴스 (현재 비어 있을 수 있음)
  competitor_trends: string | null; // 경쟁사 동향
  market_trends: string | null; // 시장 트렌드
  consumer_interests: string | null; // 소비자 관심사
  pending: boolean;
}

export function getNewsBriefing(token: string): Promise<NewsBriefing> {
  return request("/api/news/briefing", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// === 통합 검색 (뉴스/제품/게시글/세일즈 메모) ===

export interface SearchNews {
  id: number;
  title: string | null;
  description: string | null;
  company: string | null;
  link: string | null;
  date: string;
}
export interface SearchProduct {
  id: string;
  name: string;
  category: string | null;
  image: string | null;
}
export interface SearchPost {
  id: string;
  title: string;
  channel: "N" | "O";
  date: string;
}
export interface SearchMemo {
  id: number;
  title: string;
  customer: string | null;
  author: string;
  date: string;
}
export interface SearchResult {
  q: string;
  total: number;
  news: SearchNews[];
  products: SearchProduct[];
  posts: SearchPost[];
  memos: SearchMemo[];
}

export function getSearch(token: string, q: string): Promise<SearchResult> {
  return request(`/api/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// === 소비자 동향 (consumer trends) — 크롤링·분석 파이프라인 결과를 읽기만 함 ===
import type {
  Competitor,
  FeedbackItem,
  Post,
  Product,
  RankRow,
} from "../features/trends/data";

export interface ConsumerBriefing {
  interior_issues: string | null; // 인테리어 이슈/유행
  competitor_feedbacks: string | null; // 타사 제품 언급·비교
  hansol_feedbacks: string | null; // 한솔 제품 실사용 보이스
  created_at: string | null;
}

export interface ConsumerOverview {
  briefing: ConsumerBriefing | null;
  top10: RankRow[]; // 최근 7일 제품 언급량 Top10
  posts: Post[]; // 최근 게시글(5건)
}

export function getConsumerOverview(token: string): Promise<ConsumerOverview> {
  return request("/api/consumer/overview", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getConsumerPosts(token: string): Promise<{ posts: Post[] }> {
  return request("/api/consumer/posts", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface PostNeighbor {
  id: string;
  title: string;
}
export interface ConsumerPostDetail {
  post: Post;
  prev: PostNeighbor | null;
  next: PostNeighbor | null;
}

export function getConsumerPost(token: string, id: string): Promise<ConsumerPostDetail> {
  return request(`/api/consumer/posts/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ConsumerProductList {
  categories: string[];
  subcategories: string[];
  selected: string | null;
  products: Product[];
}

export function getConsumerProducts(
  token: string,
  params?: { category?: string; subcategory?: string; q?: string },
): Promise<ConsumerProductList> {
  const qs = new URLSearchParams();
  if (params?.category) qs.set("category", params.category);
  if (params?.subcategory) qs.set("subcategory", params.subcategory);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs}` : "";
  return request(`/api/consumer/products${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export interface ConsumerProductDetail {
  product: Product;
  stat: string;
  aiBriefing: string;
  positive: FeedbackItem[];
  negative: FeedbackItem[];
  competitors: Competitor[];
  posts: Post[];
}

export function getConsumerProduct(token: string, id: string): Promise<ConsumerProductDetail> {
  return request(`/api/consumer/products/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// === AI 챗봇 (LangGraph RAG) — /api/chat ===
export interface ChatSource {
  source: string;
  source_label: string;
  source_id: number;
  snippet: string;
  similarity: number;
}
export interface ChatResponse {
  status: "done" | "interrupted";
  thread_id: string;
  // done
  answer?: string;
  sources?: ChatSource[];
  selected_product_category?: string | null;
  // interrupted (제품 카테고리 선택 필요)
  message?: string;
  options?: string[];
  field?: string;
}

export function postChat(
  token: string,
  body: { question?: string; thread_id?: string; resume?: string },
): Promise<ChatResponse> {
  return request("/api/chat", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

export interface ChatHistoryMessage {
  role: "user" | "ai";
  text: string;
}
export function getChatHistory(
  token: string,
  threadId: string,
): Promise<{ thread_id: string; messages: ChatHistoryMessage[] }> {
  return request(`/api/chat/history?thread_id=${encodeURIComponent(threadId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
