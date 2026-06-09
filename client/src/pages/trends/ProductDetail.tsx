import { useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { Breadcrumb, PostCard } from '../../components/trends'
import '../../components/trends.css'
import { POSTS, PRODUCT_DETAIL, findProduct } from './data'

export default function ProductDetail() {
  const { id } = useParams()
  const product = id ? findProduct(id) : undefined

  if (!product) {
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

  const d = PRODUCT_DETAIL
  const relatedPosts = POSTS.filter((p) => p.mentions.some((m) => m.product === product.name))

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
        <div className="tr-pd-swatch" style={{ background: product.swatch }} />
        <div>
          <span className="tr-cat-chip">{product.category}</span>
          <h1 className="tr-pd-name">{product.name}</h1>
          <span className="tr-pd-stat">{d.stat}</span>
        </div>
      </div>

      <div className="tr-feedback-grid">
        <div className="tr-panel ai">
          <span className="dash-ai-label">AI 위클리 브리핑 · 최근 7일</span>
          <p>{d.aiBriefing}</p>
        </div>

        <div className="tr-panel pos">
          <span className="tr-panel-title">주요 긍정 피드백</span>
          {d.positive.map((f) => (
            <p key={f.chip} className="tr-fb-item">
              <span className="tr-fb-chip pos">{f.chip}</span>
              {f.text}
            </p>
          ))}
        </div>

        <div className="tr-panel neg">
          <span className="tr-panel-title">주요 부정 피드백</span>
          {d.negative.map((f) => (
            <p key={f.chip} className="tr-fb-item">
              <span className="tr-fb-chip neg">{f.chip}</span>
              {f.text}
            </p>
          ))}
        </div>
      </div>

      <div className="tr-bottom-grid">
        <section className="dash-card">
          <div className="dash-card-head">
            <h2>함께 자주 언급된 타사 제품 Top 5</h2>
          </div>
          <ul className="tr-rank-list">
            {d.competitors.map((c, i) => (
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
        </section>

        <div>
          <div className="tr-section-head">
            <h2>「{product.name}」 게시글</h2>
            <div className="tr-listbar" style={{ gap: 12 }}>
              <span className="tr-count">{relatedPosts.length}건</span>
              <button type="button" className="tr-sort">
                최신순
              </button>
            </div>
          </div>
          <div className="tr-post-list">
            {relatedPosts.length === 0 && (
              <div className="dash-card">
                <div className="dash-placeholder">관련 게시글이 없습니다.</div>
              </div>
            )}
            {relatedPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
