import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getNews, getNewsBriefing, type NewsArticle, type NewsBriefing, type NewsFacet } from '../../lib/api'
import AppShell from '../../components/AppShell'
import Pagination from '../../components/Pagination'
import PageHeader from '../../components/PageHeader'
import Tag from '../../components/Tag'
import FilterDropdown, { type FilterOption } from '../../components/FilterDropdown'
import { BriefingPill, BriefingPanel, type BriefingSection } from '../../components/Briefing'
import { Notice } from '../../components/EmptyState'
import { ExternalLinkIcon, RotateIcon, SearchIcon } from '../../components/icons'
import { fmtDate, toLines } from '../../lib/format'
import { newsTagKind } from '../../lib/tags'
import { useDismiss } from '../../hooks/useDismiss'
import '../trends/trends.css'
import '../sales-memo/salesmemo.css'
import './news.css'

const ALL = '전체'
const NEWS_PAGE_SIZE = 10

export default function News() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')

  const [items, setItems] = useState<NewsArticle[]>([])
  const [companies, setCompanies] = useState<NewsFacet[]>([])
  const [categories, setCategories] = useState<NewsFacet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 필터 상태: 아무것도 안 고르면(=전체) 백엔드 기본 정렬(relevance)로 내려온다.
  const [company, setCompany] = useState<string>(ALL)
  const [category, setCategory] = useState<string>(ALL)
  const [q, setQ] = useState('')

  // 드롭다운 열림 상태(한 번에 하나만). 바깥클릭/ESC 는 useDismiss 로 닫는다.
  const [openMenu, setOpenMenu] = useState<'company' | 'category' | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  useDismiss(openMenu !== null, barRef, () => setOpenMenu(null))

  // AI 위클리 브리핑 (좌측 패널, 버튼으로 토글). 기본은 펼침(디자인 기준).
  // 데이터는 백그라운드 생성분(news_briefing) — 자사/경쟁사/시장/소비자 4갈래.
  const [briefing, setBriefing] = useState<NewsBriefing | null>(null)
  const [briefingErr, setBriefingErr] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(true)

  // AI 위클리 브리핑 로드 — 백그라운드 생성분(news_briefing) 1회 조회.
  useEffect(() => {
    if (!token) return
    let active = true
    getNewsBriefing(token)
      .then((b) => active && setBriefing(b))
      .catch(() => active && setBriefingErr(true))
    return () => {
      active = false
    }
  }, [token])

  // 회사/유형이 바뀌면 서버에서 다시 불러온다(검색어 q 는 아래에서 클라이언트 필터).
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    setLoading(true)
    setError('')
    getNews(token, {
      company: company === ALL ? undefined : company,
      category: category === ALL ? undefined : category,
    })
      .then((r) => {
        setItems(r.items)
        setCompanies(r.companies)
        setCategories(r.categories)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '뉴스를 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [token, navigate, company, category])

  // 검색어는 화면에 떠 있는 결과 안에서 즉시 필터(제목·본문·회사)
  const filtered = useMemo(() => {
    const kw = q.trim()
    if (!kw) return items
    return items.filter(
      (n) =>
        (n.title ?? '').includes(kw) ||
        (n.description ?? '').includes(kw) ||
        n.company.includes(kw),
    )
  }, [items, q])

  // 페이지네이션(세일즈 메모와 동일 규칙: 10건/페이지)
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [company, category, q])
  const totalPages = Math.max(1, Math.ceil(filtered.length / NEWS_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * NEWS_PAGE_SIZE, safePage * NEWS_PAGE_SIZE)

  // 마지막 업데이트 = 노출 기사 중 가장 최근 수집 시각
  const lastUpdated = useMemo(() => {
    let latest = ''
    for (const n of items) {
      if (n.collected_at && n.collected_at > latest) latest = n.collected_at
    }
    if (!latest) return ''
    const d = new Date(latest)
    if (Number.isNaN(d.getTime())) return ''
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}.${dd} ${hh}:${mi}`
  }, [items])

  function reset() {
    setCompany(ALL)
    setCategory(ALL)
    setQ('')
    setOpenMenu(null)
  }

  // 브리핑 섹션 — 백엔드가 주는 4갈래(자사/경쟁사/시장/소비자) 중 내용이 있는 것만.
  const briefingSections: BriefingSection[] = briefing
    ? [
        { title: '자사 뉴스', lines: toLines(briefing.self_news) },
        { title: '경쟁사 제품 동향', lines: toLines(briefing.competitor_trends) },
        { title: '시장 트렌드', lines: toLines(briefing.market_trends) },
        { title: '소비자 관심사', lines: toLines(briefing.consumer_interests) },
      ].filter((s) => s.lines.length > 0)
    : []

  const companyOptions: FilterOption[] = [
    { value: ALL, label: '전체' },
    ...companies.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })),
  ]
  const categoryOptions: FilterOption[] = [
    { value: ALL, label: '전체' },
    ...categories.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })),
  ]

  return (
    <AppShell>
      <PageHeader title="뉴스">
        자사·경쟁사 동향 · 네이버 검색 OpenAPI 기반
        {lastUpdated && (
          <>
            {' · '}마지막 업데이트 <strong className="sm-update">{lastUpdated}</strong>
          </>
        )}
      </PageHeader>

      {/* 상단 바: (좌) AI 위클리 브리핑 토글  (우) 회사·유형 필터 + 검색 + 건수 */}
      <div className="sm-toprow" ref={barRef}>
        <div className={`sm-col-left${briefingOpen ? ' open' : ''}`}>
          <BriefingPill open={briefingOpen} onToggle={() => setBriefingOpen((o) => !o)} />
        </div>

        <div className="sm-col-right sm-toolbar">
          <div className="sm-filters">
            <FilterDropdown
              label={company === ALL ? '회사' : company}
              open={openMenu === 'company'}
              onToggle={() => setOpenMenu((m) => (m === 'company' ? null : 'company'))}
              options={companyOptions}
              active={company}
              onSelect={(v) => {
                setCompany(v)
                setOpenMenu(null)
              }}
            />
            <FilterDropdown
              label={category === ALL ? '유형' : category}
              open={openMenu === 'category'}
              onToggle={() => setOpenMenu((m) => (m === 'category' ? null : 'category'))}
              options={categoryOptions}
              active={category}
              onSelect={(v) => {
                setCategory(v)
                setOpenMenu(null)
              }}
            />

            {/* 화면 내 검색 */}
            <div className="tr-filter-search">
              <SearchIcon />
              <input
                type="search"
                placeholder="뉴스 제목·내용 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <button type="button" className="tr-reset" onClick={reset}>
              <RotateIcon /> 초기화
            </button>
          </div>

          <span className="sm-count">총 {filtered.length}건</span>
        </div>
      </div>

      {/* 본문: (좌) 브리핑 패널  (우) 뉴스 카드 */}
      <div className="sm-columns">
        {briefingOpen && (
          <BriefingPanel
            sections={briefingSections}
            emptyText={
              briefingErr ? 'AI 브리핑을 불러오지 못했습니다.' : 'AI가 최근 동향을 요약하는 중입니다…'
            }
          />
        )}

        <div className="sm-col-right">
          {loading ? (
            <Notice>뉴스를 불러오는 중입니다…</Notice>
          ) : error ? (
            <Notice tone="error">{error}</Notice>
          ) : filtered.length === 0 ? (
            <Notice>조건에 맞는 뉴스가 없습니다.</Notice>
          ) : (
            <div className="news-list">
              {pageItems.map((n) => (
                <article key={n.id} className="news-card">
                  <div className="news-card-body">
                    <div className="news-card-meta">
                      <Tag tone="outline">{n.company}</Tag>
                      {n.types.map((t) => (
                        <Tag key={t} tone={newsTagKind(t)}>
                          {t}
                        </Tag>
                      ))}
                      <span className="news-date">{fmtDate(n.collected_at)}</span>
                    </div>
                    <h2 className="news-title">{n.title}</h2>
                    <p className="news-summary">{n.description}</p>
                  </div>
                  {n.link && (
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="news-link"
                      aria-label="원문 보기"
                    >
                      <ExternalLinkIcon size={14} /> 원문
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}
          {!loading && !error && (
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          )}
        </div>
      </div>
    </AppShell>
  )
}
