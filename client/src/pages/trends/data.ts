// 소비자 동향 데모 데이터.
// NOTE: 소비자 동향 백엔드 API 가 아직 없어 Figma 디자인의 예시값을 그대로 사용한다.
//       API 연동 시 이 파일만 교체하면 된다.

export type Sentiment = 'pos' | 'neu' | 'neg'
export const SENTIMENT_WORD: Record<Sentiment, string> = {
  pos: '긍정',
  neu: '중립',
  neg: '부정',
}

export type Channel = 'N' | 'O'
export interface Mention {
  product: string
  sentiment: Sentiment
}

export interface Post {
  id: string
  channel: Channel
  title: string
  date: string
  likes: number
  mentions: Mention[]
  body: string
}

export interface Product {
  id: string
  category: string
  name: string
  swatch: string
}

export type TrendDir = 'up' | 'down' | 'flat'
export interface RankRow {
  category: string
  name: string
  trend: TrendDir
  value: number
}

export const TOP10: RankRow[] = [
  { category: '바닥재', name: '포그그레이', trend: 'up', value: 2 },
  { category: '바닥재', name: '조슈아라이트', trend: 'down', value: 1 },
  { category: '시트재', name: '콘크리트화이트', trend: 'flat', value: 0 },
  { category: '바닥재', name: '내추럴오크', trend: 'up', value: 3 },
  { category: '가구재', name: '스모크월넛', trend: 'down', value: 2 },
  { category: '필름', name: '모던그레이지', trend: 'up', value: 1 },
  { category: '벽장재', name: '빈티지애쉬', trend: 'flat', value: 0 },
  { category: '바닥재', name: '웜베이지', trend: 'up', value: 4 },
  { category: '가구재', name: '라이트메이플', trend: 'down', value: 3 },
  { category: '세라믹', name: '다크챠콜', trend: 'up', value: 1 },
]

export const PRODUCTS: Product[] = [
  { id: 'p1', category: '바닥재', name: '포그그레이', swatch: '#b9c0c4' },
  { id: 'p2', category: '바닥재', name: '조슈아라이트', swatch: '#e8d9c0' },
  { id: 'p3', category: '바닥재', name: '모던그레이지', swatch: '#a99c8e' },
  { id: 'p4', category: '바닥재', name: '웜베이지', swatch: '#dcc6a8' },
  { id: 'p5', category: '바닥재', name: '콘크리트화이트', swatch: '#e8e6e0' },
  { id: 'p6', category: '바닥재', name: '라이트스톤', swatch: '#d4cfc8' },
  { id: 'p7', category: '바닥재', name: '스톤베이지', swatch: '#c8bfb0' },
  { id: 'p8', category: '바닥재', name: '내추럴오크', swatch: '#d2b48c' },
  { id: 'p9', category: '바닥재', name: '스모크월넛', swatch: '#5e4434' },
  { id: 'p10', category: '바닥재', name: '빈티지애쉬', swatch: '#a89884' },
  { id: 'p11', category: '바닥재', name: '라이트메이플', swatch: '#d8b78a' },
  { id: 'p12', category: '바닥재', name: '다크챠콜', swatch: '#3a3a3a' },
  { id: 'p13', category: '바닥재', name: '딥에스프레소', swatch: '#2c1f14' },
  { id: 'p14', category: '바닥재', name: '내추럴화이트', swatch: '#f0ebe0' },
  { id: 'p15', category: '바닥재', name: '클래식오크', swatch: '#c4a06e' },
  { id: 'p16', category: '바닥재', name: '골든비치', swatch: '#d4a855' },
  { id: 'p17', category: '바닥재', name: '마블화이트', swatch: '#f5f0ea' },
  { id: 'p18', category: '바닥재', name: '컨크리트그레이', swatch: '#9e9e9e' },
  { id: 'p19', category: '바닥재', name: '우드그레이', swatch: '#8e8078' },
  { id: 'p20', category: '바닥재', name: '소프트베이지', swatch: '#e0d4c0' },
]

export const PRODUCT_CATEGORIES = ['바닥재', '가구재', '벽장재', '인테리어필름', '세라믹']
export const PRODUCT_SUBCATEGORIES = [
  '전체',
  'SB마루_스퀘어',
  'SB마루_스톤',
  'SB마루_강',
  '울트라',
  '강화마루',
  '데코타일',
  '스킨플로어',
  '교실용 마루',
]

export const POSTS: Post[] = [
  {
    id: 'post1',
    channel: 'N',
    title: '거실 바닥 포그그레이 시공 후기 (사진 多)',
    date: '06.04',
    likes: 32,
    mentions: [
      { product: '포그그레이', sentiment: 'pos' },
      { product: '조슈아라이트', sentiment: 'neu' },
    ],
    body: '이사하면서 거실 전체를 포그그레이로 깔았어요. 자연광 들어올 때 색감이 정말 차분하고 좋네요. 같이 고민했던 조슈아라이트는 샘플로만 봤는데 둘 다 무난한 편이라 결정이 어려웠습니다.',
  },
  {
    id: 'post2',
    channel: 'O',
    title: '포그그레이 마루 6개월 사용기',
    date: '06.03',
    likes: 21,
    mentions: [{ product: '포그그레이', sentiment: 'pos' }],
    body: '시공 6개월 차 후기입니다. 생활 스크래치는 생각보다 적고 청소가 편해요. 색감도 처음 그대로 잘 유지되고 있습니다.',
  },
  {
    id: 'post3',
    channel: 'N',
    title: '내추럴오크 vs 스모크월넛 고민됩니다',
    date: '06.03',
    likes: 17,
    mentions: [
      { product: '내추럴오크', sentiment: 'neu' },
      { product: '스모크월넛', sentiment: 'neg' },
    ],
    body: '거실은 밝게 가고 싶은데 내추럴오크랑 스모크월넛 중에 고민이에요. 스모크월넛은 어두운 편이라 좁아 보일까 걱정입니다.',
  },
  {
    id: 'post4',
    channel: 'N',
    title: '콘크리트화이트 생각보다 누래요;;',
    date: '06.02',
    likes: 48,
    mentions: [{ product: '콘크리트화이트', sentiment: 'neg' }],
    body: '샘플이랑 실제 시공 색이 좀 달라요. 조명 아래에서 보니 생각보다 누런 느낌이 있어서 아쉽습니다.',
  },
  {
    id: 'post5',
    channel: 'O',
    title: '웜베이지 시공 인증 - 따뜻한 거실 완성',
    date: '06.02',
    likes: 25,
    mentions: [{ product: '웜베이지', sentiment: 'pos' }],
    body: '웜베이지로 시공 끝냈습니다. 이름 그대로 따뜻한 분위기가 나서 만족스러워요. 가구랑도 잘 어울립니다.',
  },
  {
    id: 'post6',
    channel: 'N',
    title: '모던그레이지 + 다크챠콜 포인트 시공',
    date: '06.01',
    likes: 14,
    mentions: [
      { product: '모던그레이지', sentiment: 'pos' },
      { product: '다크챠콜', sentiment: 'pos' },
    ],
    body: '거실은 모던그레이지, 현관 포인트는 다크챠콜로 했어요. 조합이 깔끔하게 잘 떨어집니다.',
  },
  {
    id: 'post7',
    channel: 'N',
    title: '라이트메이플 변색 문의드려요',
    date: '06.01',
    likes: 9,
    mentions: [{ product: '라이트메이플', sentiment: 'neg' }],
    body: '시공한 지 1년 됐는데 창가 쪽이 살짝 변색된 것 같아요. 비슷한 경험 있으신 분 계신가요?',
  },
]

// 제품 상세용 데모(포그그레이 기준). 어떤 제품을 열어도 같은 분석을 보여준다.
export interface FeedbackItem {
  chip: string
  text: string
}
export interface Competitor {
  type: '비교' | '조합'
  name: string
  brand: string
}

export const PRODUCT_DETAIL = {
  stat: '최근 7일 1위 · 언급 142건',
  aiBriefing:
    "최근 7일 언급량이 2계단 상승해 1위에 올랐습니다. 타사 제품 '에코그레이'와의 조합에 대한 긍정 언급이 지난주 대비 35% 늘었습니다. 자연광 환경에서의 색감을 칭찬하는 후기가 다수 관찰됐습니다.",
  positive: [
    { chip: '차분한 색감', text: '자연광 환경에서 톤이 차분하게 떨어진다는 후기가 다수 관찰됐습니다.' },
    { chip: '조합 만족', text: "타사 '에코그레이'와의 조합에 대한 긍정 언급이 지난주 대비 35% 늘었습니다." },
    { chip: '관리 용이', text: '생활 스크래치 대비 일상 청소가 무난하다는 의견이 꾸준히 나왔습니다.' },
  ] as FeedbackItem[],
  negative: [
    { chip: '조명 의존', text: '조명 색온도에 따라 톤이 달라 보인다는 지적이 일부 있었습니다.' },
    { chip: '샘플 차이', text: '샘플과 실제 시공 결과의 색감 차이를 언급한 글이 관찰됐습니다.' },
  ] as FeedbackItem[],
  competitors: [
    { type: '비교', name: '에코그레이', brand: 'LX하우시스' },
    { type: '비교', name: '스톤그레이', brand: '동화자연마루' },
    { type: '조합', name: '어반애쉬', brand: '구정마루' },
    { type: '조합', name: '퓨어그레이', brand: '예림' },
    { type: '비교', name: '모던스톤', brand: 'KCC' },
  ] as Competitor[],
}

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id)
}
export function productByName(name: string): Product | undefined {
  return PRODUCTS.find((p) => p.name === name)
}
export function findPost(id: string): Post | undefined {
  return POSTS.find((p) => p.id === id)
}
