import { Link } from 'react-router-dom'
import {
  productBg,
  SENTIMENT_WORD,
  type Channel,
  type Mention,
  type Post,
  type Product,
  type TrendDir,
} from './data'
import { ArrowDownIcon, ArrowUpIcon, ChevronRightIcon, ExternalLinkIcon, HeartIcon } from '../../components/icons'

// 상승/하락/보합 배지(.dash-trend). 홈·소비자 동향 메인 공용.
// 국문 관례(피그마): 상승=빨강, 하락=파랑, 보합=회색.
export function TrendBadge({ trend, value }: { trend: TrendDir; value: number }) {
  if (trend === 'flat') return <span className="dash-trend flat">―</span>
  const up = trend === 'up'
  return (
    <span className={`dash-trend ${up ? 'up' : 'down'}`}>
      {up ? <ArrowUpIcon /> : <ArrowDownIcon />}
      {value}
    </span>
  )
}

// 채널 아바타 (N=셀인카페, O=오늘의집)
export function ChannelAvatar({ channel }: { channel: Channel }) {
  return <span className={`tr-avatar ch-${channel}`}>{channel}</span>
}

// 감정 칩 "제품명 긍정/중립/부정"
export function SentimentChip({ mention }: { mention: Mention }) {
  return (
    <span className={`tr-sent ${mention.sentiment}`}>
      <span className="name">{mention.product}</span>
      <span className="word">{SENTIMENT_WORD[mention.sentiment]}</span>
    </span>
  )
}

// 게시글 카드 (목록/메인 공용). 카드 전체가 상세로 이동하는 링크.
export function PostCard({ post }: { post: Post }) {
  return (
    <Link to={`/trends/posts/${post.id}`} className="tr-post">
      <ChannelAvatar channel={post.channel} />
      <div className="tr-post-body">
        <div className="tr-post-head">
          <span className="tr-post-title">{post.title}</span>
          <span className="tr-post-meta">
            <span className="tr-date">{post.date}</span>
            <span className="tr-likes">
              <HeartIcon />
              {post.likes}
            </span>
          </span>
        </div>
        <div className="tr-sent-row">
          {post.mentions.map((m) => (
            <SentimentChip key={m.product} mention={m} />
          ))}
        </div>
      </div>
      <span className="tr-post-ext" aria-hidden>
        <ExternalLinkIcon size={16} />
      </span>
    </Link>
  )
}

// 브레드크럼
export interface Crumb {
  label: string
  to?: string
}
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav className="tr-crumbs" aria-label="경로">
      {items.map((c, i) => (
        <span key={c.label} className="tr-crumb">
          {c.to ? (
            <Link to={c.to}>{c.label}</Link>
          ) : (
            <span className="current">{c.label}</span>
          )}
          {i < items.length - 1 && (
            <span className="sep" aria-hidden>
              <ChevronRightIcon size={12} />
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}

// 제품 스와치 카드 (제품 리스트 그리드)
export function ProductSwatchCard({ product }: { product: Product }) {
  return (
    <Link to={`/trends/products/${product.id}`} className="tr-pcard">
      <div className="tr-swatch" style={productBg(product)} />
      <div className="tr-pcard-meta">
        <span className="tr-cat-chip">{product.category}</span>
        <span className="tr-pcard-name">{product.name}</span>
      </div>
    </Link>
  )
}

// 작은 제품 카드 (게시글 상세 "언급된 제품 바로가기")
export function MiniProductCard({ product }: { product: Product }) {
  return (
    <Link to={`/trends/products/${product.id}`} className="tr-mini">
      <div className="tr-mini-swatch" style={productBg(product)} />
      <span className="tr-cat-chip">{product.category}</span>
      <span className="tr-mini-name">{product.name}</span>
    </Link>
  )
}
