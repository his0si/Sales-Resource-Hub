import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { ArrowDownIcon, ArrowUpIcon } from '../../components/icons'
import { PostCard } from '../../components/trends'
import '../../components/trends.css'
import { POSTS, TOP10, type RankRow } from './data'

function TrendBadge({ row }: { row: RankRow }) {
  if (row.trend === 'flat') return <span className="dash-trend flat">―</span>
  const up = row.trend === 'up'
  return (
    <span className={`dash-trend ${up ? 'up' : 'down'}`}>
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      {row.value}
    </span>
  )
}

export default function TrendsMain() {
  return (
    <AppShell>
      <div className="dash-greeting">
        <h1>소비자 동향</h1>
        <p>셀인카페 + 오늘의집 통합 · 한솔 제품 기준</p>
      </div>

      <div className="tr-ai-banner">
        <span className="dash-ai-label">AI 위클리 브리핑 · 06.04 · 통합</span>
        <p>
          최근 7일간 포그그레이 언급량이 2계단 상승해 1위를 기록했습니다. 셀인카페에서는 시공 후기,
          오늘의집에서는 사용 경험 공유가 주를 이뤘습니다. 콘크리트화이트는 변색 관련 부정 언급이 일부
          관찰됐습니다. 내추럴오크와 스모크월넛은 비교 검토 맥락에서 함께 언급되는 빈도가 늘었습니다.
        </p>
      </div>

      <div className="tr-main-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>제품 언급량 Top 10</h2>
            <span className="tr-caption-right">최근 7일</span>
          </div>
          <ul className="tr-rank-list">
            {TOP10.map((row, i) => (
              <li key={row.name}>
                <span className={`dash-rank${i >= 3 ? ' muted' : ''}`}>{i + 1}</span>
                <span className="dash-chip outline">{row.category}</span>
                <span className="dash-product">{row.name}</span>
                <TrendBadge row={row} />
              </li>
            ))}
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
            {POSTS.slice(0, 5).map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
