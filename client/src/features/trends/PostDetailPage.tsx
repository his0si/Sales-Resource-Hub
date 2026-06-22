import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getConsumerPost, type ConsumerPostDetail } from '../../lib/api'
import AppShell from '../../components/AppShell'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  ExternalLinkIcon,
} from '../../components/icons'
import {
  Breadcrumb,
  ChannelAvatar,
  MiniProductCard,
  SentimentChip,
} from './cards'
import './trends.css'
import { swatchOf, type Product } from './data'

export default function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')
  const [data, setData] = useState<ConsumerPostDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    if (!id) return
    setLoading(true)
    setNotFound(false)
    getConsumerPost(token, id)
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token, id, navigate])

  if (loading) {
    return (
      <AppShell>
        <div className="dash-card">
          <div className="dash-placeholder">불러오는 중…</div>
        </div>
      </AppShell>
    )
  }

  if (notFound || !data) {
    return (
      <AppShell>
        <Breadcrumb
          items={[
            { label: '소비자 동향', to: '/trends' },
            { label: '게시글 리스트', to: '/trends/posts' },
            { label: '게시글 상세' },
          ]}
        />
        <div className="dash-card">
          <div className="dash-placeholder">게시글을 찾을 수 없습니다.</div>
        </div>
      </AppShell>
    )
  }

  const { post, prev, next } = data
  // 언급된 제품(제품 마스터에 연결된 것)만 바로가기 카드로
  const seen = new Set<string>()
  const mentionedProducts: Product[] = post.mentions
    .filter((m) => m.product_id != null)
    .map((m) => ({
      id: String(m.product_id),
      category: m.category ?? '',
      name: m.product,
      image: m.image ?? null,
      swatch: swatchOf(m.product),
    }))
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))

  return (
    <AppShell>
      <Breadcrumb
        items={[
          { label: '소비자 동향', to: '/trends' },
          { label: '게시글 리스트', to: '/trends/posts' },
          { label: '게시글 상세' },
        ]}
      />

      <div className="tr-detail-card">
        <div className="tr-detail-head">
          <ChannelAvatar channel={post.channel} />
          <span className="tr-date">{post.date}</span>
        </div>

        <h1 className="tr-detail-title">{post.title}</h1>

        <div className="tr-detail-chips">
          {post.mentions.map((m) => (
            <SentimentChip key={m.product} mention={m} />
          ))}
        </div>

        <p className="tr-detail-body">{post.body}</p>

        <div className="tr-detail-actions">
          {post.url ? (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="tr-btn-primary">
              <ExternalLinkIcon size={16} /> 원문 바로가기
            </a>
          ) : (
            <button type="button" className="tr-btn-primary" disabled>
              <ExternalLinkIcon size={16} /> 원문 없음
            </button>
          )}
          <button
            type="button"
            className="tr-btn-outline"
            onClick={() => post.url && navigator.clipboard?.writeText(post.url)}
          >
            <CopyIcon size={16} /> 링크 복사
          </button>
        </div>

        {mentionedProducts.length > 0 && (
          <>
            <hr className="tr-divider" />
            <p className="tr-subhead">언급된 제품 바로가기</p>
            <div className="tr-mini-row">
              {mentionedProducts.map((p) => (
                <MiniProductCard key={p.id} product={p} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="tr-prevnext">
        {prev ? (
          <Link to={`/trends/posts/${prev.id}`} className="tr-nav-card">
            <ChevronLeftIcon size={16} />
            <span className="tr-nav-text">
              <span className="tr-nav-label">이전 글</span>
              <span className="tr-nav-value">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <div className="tr-nav-card disabled">
            <ChevronLeftIcon size={16} />
            <span className="tr-nav-text">
              <span className="tr-nav-label">이전 글</span>
              <span className="tr-nav-value">없음</span>
            </span>
          </div>
        )}

        {next ? (
          <Link to={`/trends/posts/${next.id}`} className="tr-nav-card next">
            <span className="tr-nav-text">
              <span className="tr-nav-label">다음 글</span>
              <span className="tr-nav-value">{next.title}</span>
            </span>
            <ChevronRightIcon size={16} />
          </Link>
        ) : (
          <div className="tr-nav-card next disabled">
            <span className="tr-nav-text">
              <span className="tr-nav-label">다음 글</span>
              <span className="tr-nav-value">없음</span>
            </span>
            <ChevronRightIcon size={16} />
          </div>
        )}
      </div>
    </AppShell>
  )
}
