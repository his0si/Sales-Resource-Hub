import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getConsumerProducts, type ConsumerProductList } from '../../lib/api'
import AppShell from '../../components/AppShell'
import Pagination from '../../components/Pagination'
import PageHeader from '../../components/PageHeader'
import EmptyState, { Notice } from '../../components/EmptyState'
import { Breadcrumb, ProductSwatchCard } from './cards'
import './trends.css'

const PRODUCT_PAGE_SIZE = 12

export default function ProductList() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')
  const [data, setData] = useState<ConsumerProductList | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [cat, setCat] = useState<string | undefined>(undefined)
  const [sub, setSub] = useState('전체')
  const [page, setPage] = useState(1)
  useEffect(() => {
    setPage(1)
  }, [cat, sub])

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    setLoading(true)
    getConsumerProducts(token, { category: cat, subcategory: sub })
      .then((r) => {
        setData(r)
        // 첫 로드 시 백엔드가 고른 기본 카테고리를 상태에 반영
        if (!cat && r.selected) setCat(r.selected)
      })
      .catch((e) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [token, navigate, cat, sub])

  const categories = data?.categories ?? []
  const subcategories = data?.subcategories ?? ['전체']
  const products = data?.products ?? []
  const activeCat = cat ?? data?.selected ?? ''
  const totalPages = Math.max(1, Math.ceil(products.length / PRODUCT_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = products.slice((safePage - 1) * PRODUCT_PAGE_SIZE, safePage * PRODUCT_PAGE_SIZE)

  return (
    <AppShell>
      <Breadcrumb items={[{ label: '소비자 동향', to: '/trends' }, { label: '제품 리스트' }]} />

      <PageHeader title="제품 리스트" />

      <div className="tr-cat-card">
        <div className="tr-cat-row">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className={`tr-cat-pill${c === activeCat ? ' active' : ''}`}
              onClick={() => {
                setCat(c)
                setSub('전체')
              }}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="tr-cat-row">
          {subcategories.map((s) => (
            <button
              key={s}
              type="button"
              className={`tr-subcat-pill${s === sub ? ' active' : ''}`}
              onClick={() => setSub(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Notice>제품을 불러오는 중입니다…</Notice>
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <>
          <div className="tr-grid">
            {pageItems.map((p) => (
              <ProductSwatchCard key={p.id} product={p} />
            ))}
            {products.length === 0 && <EmptyState>제품이 없습니다.</EmptyState>}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </AppShell>
  )
}
