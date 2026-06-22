import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getConsumerOverview, type ConsumerOverview } from '../../lib/api'
import AppShell from '../../components/AppShell'
import PageHeader from '../../components/PageHeader'
import Tag from '../../components/Tag'
import EmptyState from '../../components/EmptyState'
import { PostCard, TrendBadge } from './cards'
import { fmtDate, toLines } from '../../lib/format'
import './trends.css'

export default function TrendsMain() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')
  const [data, setData] = useState<ConsumerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    getConsumerOverview(token)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [token, navigate])

  const briefing = data?.briefing
  const briefSections = briefing
    ? [
        { label: '인테리어 이슈', lines: toLines(briefing.interior_issues, { stripMarkdown: true, max: 2 }) },
        { label: '타사 언급', lines: toLines(briefing.competitor_feedbacks, { stripMarkdown: true, max: 2 }) },
        { label: '한솔 보이스', lines: toLines(briefing.hansol_feedbacks, { stripMarkdown: true, max: 2 }) },
      ].filter((s) => s.lines.length > 0)
    : []

  return (
    <AppShell>
      <PageHeader title="소비자 동향">셀인카페 + 오늘의집 통합 · 한솔 제품 기준</PageHeader>

      <div className="tr-ai-banner">
        <span className="dash-ai-label">
          AI 위클리 브리핑{briefing?.created_at ? ` · ${fmtDate(briefing.created_at)}` : ''} · 통합
        </span>
        {briefSections.length > 0 ? (
          briefSections.map((s) => (
            <p key={s.label}>
              <strong>{s.label}</strong> · {s.lines.join(' ')}
            </p>
          ))
        ) : (
          <p>{loading ? 'AI 브리핑을 불러오는 중입니다…' : 'AI 브리핑이 아직 생성되지 않았습니다.'}</p>
        )}
      </div>

      {error && <p style={{ color: '#c0392b', padding: '8px 4px' }}>{error}</p>}

      <div className="tr-main-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>제품 언급량 Top 10</h2>
            <span className="tr-caption-right">최근 7일</span>
          </div>
          <ul className="tr-rank-list">
            {(data?.top10 ?? []).map((row, i) => (
              <li key={row.id ?? row.name}>
                <span className={`dash-rank${i >= 3 ? ' muted' : ''}`}>{i + 1}</span>
                <Tag tone="outline">{row.category}</Tag>
                {row.id ? (
                  <Link to={`/trends/products/${row.id}`} className="dash-product">
                    {row.name}
                  </Link>
                ) : (
                  <span className="dash-product">{row.name}</span>
                )}
                <TrendBadge trend={row.trend} value={row.value} />
              </li>
            ))}
            {!loading && (data?.top10?.length ?? 0) === 0 && (
              <li className="dash-placeholder">최근 7일 언급된 제품이 없습니다.</li>
            )}
          </ul>
          <div className="tr-top10-foot">
            언급량은 게시글 1표 + 댓글 가중(참여도 가중, 의도된 설계). 오늘의집 댓글은 집계 제외.
          </div>
        </section>

        <div>
          <div className="tr-section-head">
            <h2>게시글 리스트</h2>
            <Link to="/trends/posts" className="tr-more">
              더보기
            </Link>
          </div>
          <div className="tr-post-list">
            {(data?.posts ?? []).slice(0, 5).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {!loading && (data?.posts?.length ?? 0) === 0 && <EmptyState>게시글이 없습니다.</EmptyState>}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
