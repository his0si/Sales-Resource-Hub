// 칩/태그 색상 변형. app.css 의 .dash-chip(.outline|.tag-*) 색상과 매칭된다.
export type TagTone = 'outline' | 'red' | 'azure' | 'green' | 'yellow' | 'violet'

// 뉴스 유형(카테고리) → 칩 색상. 뉴스 리스트/홈 위젯에서 공용으로 쓴다.
const NEWS_TAG_KIND: Record<string, TagTone> = {
  '신제품/MOU': 'red',
  '시장동향/건설경기': 'violet',
  '경영/재무': 'azure',
  '친환경/ESG': 'green',
  '유통/채널': 'yellow',
  기타: 'violet',
}

// 유형명 → dash-chip 색상 변형(없으면 violet 폴백)
export function newsTagKind(type: string): TagTone {
  return NEWS_TAG_KIND[type] ?? 'violet'
}
