import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getConsumerProduct, type ConsumerProductDetail } from '../../lib/api'
import AppShell from '../../components/AppShell'
import { Breadcrumb, PostCard } from './cards'
import './trends.css'
import { productBg } from './data'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')
  const [data, setData] = useState<ConsumerProductDetail | null>(null)
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
    getConsumerProduct(token, id)
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
            { label: '제품 리스트', to: '/trends/products' },
            { label: '제품 상세' },
          ]}
        />
        <div className="dash-card">
          <div className="dash-placeholder">제품을 찾을 수 없습니다.</div>
        </div>
      </AppShell>
    )
  }

  const { product, stat, aiBriefing, positive, negative, competitors, posts } = data

  return (
    <AppShell>
      <Breadcrumb
        items={[
          { label: '소비자 동향', to: '/trends' },
          { label: '제품 리스트', to: '/trends/products' },
          { label: product.name },
        ]}
      />

      <div className="tr-pd-header">
        <div className="tr-pd-swatch" style={productBg(product)} />
        <div>
          <span className="tr-cat-chip">{product.category}</span>
          <h1 className="tr-pd-name">{product.name}</h1>
          <span className="tr-pd-stat">{stat}</span>
        </div>
      </div>

      <div className="tr-feedback-grid">
        <div className="tr-panel ai">
          <span className="dash-ai-label">AI 위클리 브리핑 · 최근 7일</span>
          <p>{aiBriefing || '아직 생성된 브리핑이 없습니다.'}</p>
        </div>

        <div className="tr-panel pos">
          <span className="tr-panel-title">주요 긍정 피드백</span>
          {positive.length > 0 ? (
            positive.map((f) => (
              <p key={f.chip} className="tr-fb-item">
                <span className="tr-fb-chip pos">{f.chip}</span>
                {f.text}
              </p>
            ))
          ) : (
            <p className="tr-fb-item">긍정 피드백이 아직 없습니다.</p>
          )}
        </div>

        <div className="tr-panel neg">
          <span className="tr-panel-title">주요 부정 피드백</span>
          {negative.length > 0 ? (
            negative.map((f) => (
              <p key={f.chip} className="tr-fb-item">
                <span className="tr-fb-chip neg">{f.chip}</span>
                {f.text}
              </p>
            ))
          ) : (
            <p className="tr-fb-item">부정 피드백이 아직 없습니다.</p>
          )}
        </div>
      </div>

      <div className="tr-bottom-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>함께 자주 언급된 타사 제품 Top 5</h2>
          </div>
          {competitors.length > 0 ? (
            <ul className="tr-rank-list">
              {competitors.map((c, i) => (
                <li key={c.name}>
                  <span className={`dash-rank${i >= 3 ? ' muted' : ''}`}>{i + 1}</span>
                  <span className={`tr-type-chip ${c.type === '비교' ? 'compare' : 'combo'}`}>
                    {c.type}
                  </span>
                  <span className="tr-comp-name">{c.name}</span>
                  <span className="tr-comp-brand">{c.brand}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dash-placeholder">타사 비교 데이터는 준비 중입니다.</div>
          )}
        </section>

        <div>
          <div className="tr-section-head">
            <h2>「{product.name}」 게시글</h2>
            <div className="tr-listbar" style={{ gap: 12 }}>
              <span className="tr-count">{posts.length}건</span>
              <button type="button" className="tr-sort">
                최신순
              </button>
            </div>
          </div>
          <div className="tr-post-list">
            {posts.length === 0 && (
              <div className="dash-card">
                <div className="dash-placeholder">관련 게시글이 없습니다.</div>
              </div>
            )}
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
