import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon } from '../components/icons'

// NOTE: 소비자 동향/뉴스 백엔드 API 가 아직 없어 디자인의 예시 데이터를 그대로 사용한다.
//       API 연동 시 아래 상수만 교체하면 된다.

type Trend = 'up' | 'down' | 'flat'
interface TopProduct {
  category: string
  name: string
  trend: Trend
  value: number
}
const TOP_PRODUCTS: TopProduct[] = [
  { category: '바닥재', name: '포그그레이', trend: 'up', value: 2 },
  { category: '바닥재', name: '조슈아라이트', trend: 'down', value: 1 },
  { category: '시트재', name: '콘크리트화이트', trend: 'flat', value: 0 },
  { category: '바닥재', name: '내추럴오크', trend: 'up', value: 3 },
  { category: '가구재', name: '스모크월넛', trend: 'down', value: 2 },
]

type TagKind = 'red' | 'azure' | 'green' | 'yellow'
interface NewsItem {
  source: string
  tag: string
  kind: TagKind
  title: string
  date: string
}
const NEWS: NewsItem[] = [
  {
    source: 'LX하우시스',
    tag: '신제품·출시',
    kind: 'red',
    title: 'LX하우시스, 친환경 바닥재 신제품 라인 출시',
    date: '06.03',
  },
  {
    source: '동화자연마루',
    tag: '실적·재무',
    kind: 'azure',
    title: '동화자연마루 2분기 영업이익 전년比 12% 증가',
    date: '06.02',
  },
  {
    source: '한솔',
    tag: '친환경·인증',
    kind: 'green',
    title: '한솔홈데코, 저탄소 인증 마루 제품 확대',
    date: '06.02',
  },
  {
    source: 'KCC',
    tag: '유통·채널',
    kind: 'yellow',
    title: 'KCC, 건자재 유통망 재편 본격화',
    date: '06.01',
  },
]

interface MemoItem {
  title: string
  author: string
  team: string
  tags: string[]
}
const MEMOS: MemoItem[] = [
  {
    title: '○○인테리어, 포그그레이 대량 견적 문의',
    author: '박수석',
    team: '바닥재 영업',
    tags: ['포그그레이', '대구', '견적'],
  },
  {
    title: '수원 △△매장, 내추럴오크 샘플 추가 요청',
    author: '김책임',
    team: '바닥재 영업',
    tags: ['내추럴오크', '수원', '샘플'],
  },
  {
    title: '주간 상담 메모 공유 (포그그레이 문의 다수)',
    author: '이선임',
    team: '바닥재 영업',
    tags: ['포그그레이', '고객반응', '주간'],
  },
  {
    title: '상업공간 프로젝트 LX 경쟁 상황 공유',
    author: '이선임',
    team: '상업공간 파트너팀',
    tags: ['경쟁사', '상업공간', 'LX'],
  },
]

function TrendBadge({ trend, value }: { trend: Trend; value: number }) {
  if (trend === 'flat') return <span className="dash-trend flat">―</span>
  const up = trend === 'up'
  return (
    <span className={`dash-trend ${up ? 'up' : 'down'}`}>
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      {value}
    </span>
  )
}

export default function Home() {
  return (
    <AppShell>
      <div className="dash-greeting">
        <h1>안녕하세요, 김영업님</h1>
        <p>오늘 · 2026.06.06</p>
      </div>

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
            <ul className="dash-top5">
              {TOP_PRODUCTS.map((p, i) => (
                <li key={p.name} className="dash-top5-row">
                  <span className={`dash-rank${i >= 3 ? ' muted' : ''}`}>{i + 1}</span>
                  <span className="dash-chip outline">{p.category}</span>
                  <span className="dash-product">{p.name}</span>
                  <TrendBadge trend={p.trend} value={p.value} />
                </li>
              ))}
            </ul>
          </div>
          <div className="dash-ai">
            <span className="dash-ai-label">AI 위클리 브리핑 · 06.06</span>
            <p>
              최근 7일간 포그그레이 언급량이 2계단 상승해 1위를 기록했습니다. 셀인카페에서는 시공
              후기, 오늘의집에서는 사용 경험 공유가 주를 이뤘습니다.
            </p>
            <p>
              콘크리트화이트는 변색 관련 부정 언급이 일부 관찰됐습니다. 내추럴오크와 스모크월넛은 비교
              검토 맥락에서 함께 언급되는 빈도가 늘었습니다.
            </p>
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
          <ul className="dash-list">
            {NEWS.map((n) => (
              <li key={n.title} className="dash-news-row">
                <div className="dash-news-meta">
                  <span className="dash-chip outline">{n.source}</span>
                  <span className={`dash-chip tag-${n.kind}`}>{n.tag}</span>
                  <span className="dash-date">{n.date}</span>
                </div>
                <div className="dash-news-title">
                  <span>{n.title}</span>
                  <button type="button" className="dash-ext" aria-label="원문 보기">
                    <ExternalLinkIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* 세일즈 메모 */}
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>세일즈 메모</h2>
            <Link to="/sales-memo" className="dash-link">
              세일즈 메모 전체 보기 →
            </Link>
          </div>
          <ul className="dash-list">
            {MEMOS.map((m) => (
              <li key={m.title} className="dash-memo-row">
                <span className="dash-memo-title">{m.title}</span>
                <span className="dash-memo-author">
                  {m.author} · {m.team}
                </span>
                <div className="dash-tags">
                  {m.tags.map((t) => (
                    <span key={t} className="dash-hashtag">
                      #{t}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  )
}
