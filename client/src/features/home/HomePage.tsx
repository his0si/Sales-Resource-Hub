import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getConsumerOverview,
  getMe,
  getNews,
  getSalesMemoBoard,
  type ConsumerOverview,
  type Me,
  type MemoBoardItem,
  type NewsArticle,
} from '../../lib/api'
import AppShell from '../../components/AppShell'
import PageHeader from '../../components/PageHeader'
import Tag from '../../components/Tag'
import { TrendBadge } from '../trends/cards'
import { ExternalLinkIcon } from '../../components/icons'
import { fmtDate, today, toLines } from '../../lib/format'
import { newsTagKind } from '../../lib/tags'

export default function Home() {
  const token = localStorage.getItem('access_token')

  // 인사말에 회원가입 시 입력한 실제 이름(DB)을 사용한다.
  const [me, setMe] = useState<Me | null>(null)
  // 대시보드 3개 위젯은 각각 실제 백엔드 API 를 읽는다.
  const [overview, setOverview] = useState<ConsumerOverview | null>(null)
  const [news, setNews] = useState<NewsArticle[]>([])
  const [memos, setMemos] = useState<MemoBoardItem[]>([])

  useEffect(() => {
    if (!token) return
    let active = true
    getMe(token)
      .then((m) => active && setMe(m))
      .catch(() => {})
    getConsumerOverview(token)
      .then((o) => active && setOverview(o))
      .catch(() => {})
    getNews(token, { limit: 4 })
      .then((r) => active && setNews(r.items.slice(0, 4)))
      .catch(() => {})
    getSalesMemoBoard(token)
      .then((r) => active && setMemos(r.items.slice(0, 4)))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [token])

  const greetingName = me?.name?.trim() || '영업'
  const top5 = overview?.top10?.slice(0, 5) ?? []
  // 소비자 동향 AI 브리핑(인테리어 이슈/타사·자사 보이스)에서 내용 있는 갈래만.
  const briefing = overview?.briefing
  const briefLines = briefing
    ? [...toLines(briefing.interior_issues), ...toLines(briefing.competitor_feedbacks)].slice(0, 3)
    : []

  return (
    <AppShell>
      <PageHeader title={`안녕하세요, ${greetingName}님`}>오늘 · {today()}</PageHeader>

      {/* 소비자 동향 */}
      <section className="dash-card">
        <div className="dash-card-head">
          <h2>소비자 동향</h2>
          <Link to="/trends" className="dash-link">
            소비자 동향 전체 보기 →
          </Link>
        </div>
        <div className="dash-trends-grid">
          <div className="dash-trends-left">
            <p className="dash-caption">제품 언급량 Top 5 · 최근 7일</p>
            {top5.length > 0 ? (
              <ul className="dash-top5">
                {top5.map((p, i) => (
                  <li key={p.id ?? p.name} className="dash-top5-row">
                    <span className={`dash-rank${i >= 3 ? ' muted' : ''}`}>{i + 1}</span>
                    <Tag tone="outline">{p.category}</Tag>
                    <span className="dash-product">{p.name}</span>
                    <TrendBadge trend={p.trend} value={p.value} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dash-caption">집계된 언급량 데이터가 아직 없습니다.</p>
            )}
          </div>
          <div className="dash-ai">
            <span className="dash-ai-label">
              AI 위클리 브리핑{briefing?.created_at ? ` · ${fmtDate(briefing.created_at)}` : ''}
            </span>
            {briefLines.length > 0 ? (
              briefLines.map((line, i) => <p key={i}>{line}</p>)
            ) : (
              <p>AI가 최근 소비자 동향을 요약하는 중입니다…</p>
            )}
          </div>
        </div>
      </section>

      <div className="dash-bottom-grid">
        {/* 뉴스 */}
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>뉴스</h2>
            <Link to="/news" className="dash-link">
              뉴스 전체 보기 →
            </Link>
          </div>
          {news.length > 0 ? (
            <ul className="dash-list">
              {news.map((n) => (
                <li key={n.id} className="dash-news-row">
                  <div className="dash-news-meta">
                    <Tag tone="outline">{n.company}</Tag>
                    {n.types[0] && <Tag tone={newsTagKind(n.types[0])}>{n.types[0]}</Tag>}
                    <span className="dash-date">{fmtDate(n.collected_at)}</span>
                  </div>
                  <div className="dash-news-title">
                    <span>{n.title}</span>
                    {n.link && (
                      <a
                        href={n.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dash-ext"
                        aria-label="원문 보기"
                      >
                        <ExternalLinkIcon />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dash-placeholder">표시할 뉴스가 없습니다.</div>
          )}
        </section>

        {/* 세일즈 메모 */}
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>세일즈 메모</h2>
            <Link to="/sales-memo" className="dash-link">
              세일즈 메모 전체 보기 →
            </Link>
          </div>
          {memos.length > 0 ? (
            <ul className="dash-list">
              {memos.map((m) => (
                <li key={m.id} className="dash-memo-row">
                  <span className="dash-memo-title">{m.title}</span>
                  <span className="dash-memo-author">
                    {m.author}
                    {m.dept ? ` · ${m.dept}` : ''}
                  </span>
                  {m.tags.length > 0 && (
                    <div className="dash-tags">
                      {m.tags.map((t) => (
                        <span key={t} className="dash-hashtag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="dash-placeholder">표시할 세일즈 메모가 없습니다.</div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
