import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { getSearch, type SearchResult } from '../../lib/api'
import AppShell from '../../components/AppShell'
import PageHeader from '../../components/PageHeader'
import Tag from '../../components/Tag'
import EmptyState, { Notice } from '../../components/EmptyState'
import { ExternalLinkIcon } from '../../components/icons'
import { productBg, swatchOf } from '../trends/data'
import './search.css'

const EMPTY: SearchResult = { q: '', total: 0, news: [], products: [], posts: [], memos: [] }

export default function SearchPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = params.get('q')?.trim() ?? ''
  const token = localStorage.getItem('access_token')

  const [data, setData] = useState<SearchResult>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    if (!q) {
      setData(EMPTY)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    getSearch(token, q)
      .then((r) => active && setData(r))
      .catch((e) => active && setError(e instanceof Error ? e.message : '검색에 실패했습니다.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [token, q, navigate])

  return (
    <AppShell>
      <PageHeader title="통합 검색">
        {q ? (
          <>
            "{q}" 검색 결과 · 총 <strong className="sm-update">{data.total}</strong>건
          </>
        ) : (
          '상단 검색창에 제품·뉴스·메모 키워드를 입력하세요.'
        )}
      </PageHeader>

      {!q ? null : loading ? (
        <Notice>검색 중입니다…</Notice>
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : data.total === 0 ? (
        <EmptyState>「{q}」에 대한 검색 결과가 없습니다.</EmptyState>
      ) : (
        <div className="search-groups">
          {data.news.length > 0 && (
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>뉴스 {data.news.length}건</h2>
                <Link to="/news" className="dash-link">
                  뉴스 전체 →
                </Link>
              </div>
              {data.news.map((n) => (
                <a
                  key={n.id}
                  className="search-row"
                  href={n.link ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="search-row-main">
                    <span className="search-row-title">{n.title}</span>
                    <span className="search-row-sub">
                      {n.company}
                      {n.description ? ` · ${n.description}` : ''}
                    </span>
                  </div>
                  <span className="search-row-date">{n.date}</span>
                  <ExternalLinkIcon size={14} />
                </a>
              ))}
            </section>
          )}

          {data.products.length > 0 && (
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>제품 {data.products.length}건</h2>
                <Link to="/trends/products" className="dash-link">
                  제품 리스트 →
                </Link>
              </div>
              {data.products.map((p) => (
                <Link key={p.id} to={`/trends/products/${p.id}`} className="search-row">
                  <div
                    className="search-thumb"
                    style={productBg({ image: p.image, swatch: swatchOf(p.name) })}
                  />
                  <div className="search-row-main">
                    <span className="search-row-title">{p.name}</span>
                    {p.category && (
                      <span className="search-row-sub">
                        <Tag tone="outline">{p.category}</Tag>
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </section>
          )}

          {data.posts.length > 0 && (
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>소비자 게시글 {data.posts.length}건</h2>
                <Link to="/trends/posts" className="dash-link">
                  게시글 리스트 →
                </Link>
              </div>
              {data.posts.map((p) => (
                <Link key={p.id} to={`/trends/posts/${p.id}`} className="search-row">
                  <div className="search-row-main">
                    <span className="search-row-title">{p.title}</span>
                    <span className="search-row-sub">
                      {p.channel === 'O' ? '오늘의집' : '셀인카페'}
                    </span>
                  </div>
                  <span className="search-row-date">{p.date}</span>
                </Link>
              ))}
            </section>
          )}

          {data.memos.length > 0 && (
            <section className="dash-card">
              <div className="dash-card-head">
                <h2>세일즈 메모 {data.memos.length}건</h2>
                <Link to="/sales-memo" className="dash-link">
                  세일즈 메모 →
                </Link>
              </div>
              {data.memos.map((m) => (
                <Link key={m.id} to="/sales-memo" className="search-row">
                  <div className="search-row-main">
                    <span className="search-row-title">{m.title}</span>
                    <span className="search-row-sub">
                      {[m.customer, m.author].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <span className="search-row-date">{m.date}</span>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </AppShell>
  )
}
