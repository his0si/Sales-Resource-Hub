import { useState } from 'react'
import AppShell from '../../components/AppShell'
import { Breadcrumb, ProductSwatchCard } from '../../components/trends'
import '../../components/trends.css'
import { PRODUCTS, PRODUCT_CATEGORIES, PRODUCT_SUBCATEGORIES } from './data'

export default function ProductList() {
  const [cat, setCat] = useState(PRODUCT_CATEGORIES[0])
  const [sub, setSub] = useState(PRODUCT_SUBCATEGORIES[0])

  return (
    <AppShell>
      <Breadcrumb items={[{ label: '소비자 동향', to: '/trends' }, { label: '제품 리스트' }]} />

      <div className="dash-greeting">
        <h1>제품 리스트</h1>
      </div>

      <div className="tr-cat-card">
        <div className="tr-cat-row">
          {PRODUCT_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`tr-cat-pill${c === cat ? ' active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="tr-cat-row">
          {PRODUCT_SUBCATEGORIES.map((s) => (
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

      <div className="tr-grid">
        {PRODUCTS.map((p) => (
          <ProductSwatchCard key={p.id} product={p} />
        ))}
      </div>

      <div className="tr-pagination">
        <button type="button" className="tr-page active">
          1
        </button>
        <button type="button" className="tr-page">
          2
        </button>
      </div>
    </AppShell>
  )
}
