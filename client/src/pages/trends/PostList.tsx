import { useState } from 'react'
import AppShell from '../../components/AppShell'
import { ChevronDownIcon, RotateIcon, SearchIcon } from '../../components/icons'
import { Breadcrumb, PostCard } from '../../components/trends'
import '../../components/trends.css'
import { POSTS } from './data'

export default function PostList() {
  const [q, setQ] = useState('')

  const filtered = POSTS.filter(
    (p) =>
      !q.trim() ||
      p.title.includes(q.trim()) ||
      p.mentions.some((m) => m.product.includes(q.trim())),
  )

  return (
    <AppShell>
      <Breadcrumb
        items={[{ label: '소비자 동향', to: '/trends' }, { label: '게시글 리스트' }]}
      />

      <div className="dash-greeting">
        <h1>게시글 리스트</h1>
        <p>소비자 동향 전체 게시글</p>
      </div>

      <div className="tr-filterbar">
        <button type="button" className="tr-filter-pill">
          카테고리 <ChevronDownIcon size={14} />
        </button>
        <button type="button" className="tr-filter-pill">
          채널 <ChevronDownIcon size={14} />
        </button>
        <button type="button" className="tr-filter-pill">
          기간 <ChevronDownIcon size={14} />
        </button>
        <div className="tr-filter-right">
          <div className="tr-filter-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="제목·제품명 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className="tr-reset" onClick={() => setQ('')}>
            <RotateIcon /> 초기화
          </button>
        </div>
      </div>

      <div className="tr-listbar">
        <span className="tr-count">{filtered.length}건</span>
        <button type="button" className="tr-sort">
          최신순
        </button>
      </div>

      <div className="tr-post-list">
        {filtered.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </AppShell>
  )
}
