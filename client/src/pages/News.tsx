import { useState } from 'react'
import AppShell from '../components/AppShell'
import { ChevronDownIcon, ExternalLinkIcon, RotateIcon, SearchIcon } from '../components/icons'
import '../components/trends.css'
import '../components/news.css'

// NOTE: 뉴스 백엔드(네이버 검색 OpenAPI) 연동 전이라 디자인 예시 데이터를 사용한다.
type TagKind = 'red' | 'azure' | 'green' | 'yellow' | 'violet'
interface NewsItem {
  source: string
  tag: string
  kind: TagKind
  date: string
  title: string
  summary: string
}

const NEWS: NewsItem[] = [
  {
    source: 'LX하우시스',
    tag: '신제품·출시',
    kind: 'red',
    date: '06.03',
    title: 'LX하우시스, 친환경 바닥재 신제품 라인 출시',
    summary:
      'LX하우시스가 친환경 인증을 받은 바닥재 신제품 라인을 공개했다. 저탄소 공정과 재활용 소재 비중 확대를 강조했다.',
  },
  {
    source: '동화자연마루',
    tag: '실적·재무',
    kind: 'azure',
    date: '06.02',
    title: '동화자연마루 2분기 영업이익 전년比 12% 증가',
    summary:
      '동화자연마루는 2분기 매출과 영업이익이 모두 증가했다고 밝혔다. 리모델링 수요 견조와 신제품 라인 효과가 반영됐다고 설명했다.',
  },
  {
    source: '한솔',
    tag: '친환경·인증',
    kind: 'green',
    date: '06.02',
    title: '한솔홈데코, 저탄소 인증 마루 제품 확대',
    summary:
      '한솔홈데코가 저탄소 인증을 획득한 마루 제품 라인업을 확대한다. 친환경 인증 기준에 맞춘 공정 전환을 병행한다.',
  },
  {
    source: 'KCC',
    tag: '유통·채널',
    kind: 'yellow',
    date: '06.01',
    title: 'KCC, 건자재 유통망 재편 본격화',
    summary:
      'KCC가 건자재 유통 채널을 재편하고 거점 대리점 중심으로 운영 효율화를 추진한다고 발표했다.',
  },
  {
    source: '기타',
    tag: '부동산·건설경기',
    kind: 'green',
    date: '05.31',
    title: '건설경기 둔화 속 리모델링 수요는 견조',
    summary:
      '신축 건설 경기가 둔화된 가운데 리모델링·인테리어 수요는 상대적으로 견조한 흐름을 이어가고 있다는 분석이 나왔다.',
  },
  {
    source: '구정마루',
    tag: '신제품·출시',
    kind: 'red',
    date: '05.30',
    title: '구정마루, 신규 패턴 시리즈 공개',
    summary:
      '구정마루가 워시드 톤 중심의 신규 패턴 시리즈를 공개했다. 자연광 환경에서의 색감을 강조한 라인업이다.',
  },
  {
    source: '예림',
    tag: '사업·투자',
    kind: 'azure',
    date: '05.29',
    title: '예림, 생산 설비 증설 투자 결정',
    summary:
      '예림이 마루 생산 설비 증설을 결정했다. 수요 확대에 대응한 캐파 확보가 목적이라고 밝혔다.',
  },
  {
    source: '기타',
    tag: '트렌드·시장동향',
    kind: 'violet',
    date: '05.28',
    title: '워시드 우드 톤, 인테리어 트렌드로 부상',
    summary:
      '워시드 우드 톤과 그레이 계열 마루가 최근 인테리어 트렌드로 부상하고 있다는 시장 분석이 나왔다.',
  },
]

export default function News() {
  const [q, setQ] = useState('')

  const filtered = NEWS.filter(
    (n) =>
      !q.trim() ||
      n.title.includes(q.trim()) ||
      n.summary.includes(q.trim()) ||
      n.source.includes(q.trim()),
  )

  return (
    <AppShell>
      <div className="dash-greeting">
        <h1>뉴스</h1>
        <p>자사·경쟁사 동향 · 네이버 검색 OpenAPI 기반</p>
      </div>

      <div className="tr-ai-banner">
        <span className="dash-ai-label">AI 위클리 브리핑 · 최근 7일</span>
        <p>
          이번 주 자사·경쟁사 뉴스에서는 친환경·저탄소 인증 관련 발표가 다수 관찰됐습니다. LX하우시스가
          친환경 바닥재 신제품 라인을 공개했고, 한솔홈데코는 저탄소 인증 마루 라인업을 확대했습니다.
          동화자연마루는 2분기 실적이 전년 대비 12% 증가했다고 밝혔습니다. 시장 분석에서는 워시드 우드
          톤과 그레이 계열 마루의 트렌드 부상이 언급됐습니다.
        </p>
      </div>

      <div className="tr-filterbar">
        <button type="button" className="tr-filter-pill">
          회사 <ChevronDownIcon size={14} />
        </button>
        <button type="button" className="tr-filter-pill">
          유형 <ChevronDownIcon size={14} />
        </button>
        <div className="tr-filter-right">
          <div className="tr-filter-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="뉴스 제목·내용 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className="tr-reset" onClick={() => setQ('')}>
            <RotateIcon /> 초기화
          </button>
        </div>
      </div>

      <div className="news-list">
        {filtered.map((n) => (
          <article key={n.title} className="news-card">
            <div className="news-card-body">
              <div className="news-card-meta">
                <span className="dash-chip outline">{n.source}</span>
                <span className={`dash-chip tag-${n.kind}`}>{n.tag}</span>
                <span className="news-date">{n.date}</span>
              </div>
              <h2 className="news-title">{n.title}</h2>
              <p className="news-summary">{n.summary}</p>
            </div>
            <button type="button" className="news-link" aria-label="원문 보기">
              <ExternalLinkIcon size={14} /> 원문
            </button>
          </article>
        ))}
      </div>
    </AppShell>
  )
}
