// 소비자 동향 화면이 쓰는 타입 정의.
// 데이터는 백엔드 /api/consumer/* (raw_consumer_trend·consumer_product·cp_briefing·
// consumer_briefing·product 테이블)에서 받아온다. (예전엔 이 파일에 예시 데이터가 있었음)

import type { CSSProperties } from 'react'

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
  product_id?: number | string | null
  category?: string | null
  image?: string | null // 언급 제품의 이미지 URL(있으면)
}

// 제품명 → 결정적 파스텔 색상(백엔드 _swatch 와 동일 알고리즘, 화면 일관성용).
export function swatchOf(name: string | null | undefined): string {
  if (!name) return '#cfcabf'
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) & 0xffffffff
  return `hsl(${h % 360}, 28%, 72%)`
}

export interface Post {
  id: string
  channel: Channel
  title: string
  date: string
  likes: number
  mentions: Mention[]
  body: string
  url?: string | null
}

export interface Product {
  id: string
  category: string
  subcategory?: string | null
  name: string
  image?: string | null // 실제 제품 이미지 URL(/images/...). 없으면 swatch 색상 폴백
  swatch: string
}

// 제품 카드 배경 스타일 — 이미지가 있으면 이미지, 없으면 스와치 색상.
export function productBg(p: { image?: string | null; swatch: string }): CSSProperties {
  if (p.image) {
    return {
      backgroundImage: `url("${p.image}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  return { background: p.swatch }
}

export type TrendDir = 'up' | 'down' | 'flat'
export interface RankRow {
  id?: string
  category: string
  name: string
  trend: TrendDir
  value: number
}

export interface FeedbackItem {
  chip: string
  text: string
}
export interface Competitor {
  type: '비교' | '조합'
  name: string
  brand: string
}
