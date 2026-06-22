import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getConsumerPosts } from '../../lib/api'
import AppShell from '../../components/AppShell'
import PageHeader from '../../components/PageHeader'
import EmptyState, { Notice } from '../../components/EmptyState'
import { ChevronDownIcon, RotateIcon, SearchIcon } from '../../components/icons'
import { Breadcrumb, PostCard } from './cards'
import './trends.css'
import type { Post } from './data'

export default function PostList() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    getConsumerPosts(token)
      .then((r) => setPosts(r.posts))
      .catch((e) => setError(e instanceof Error ? e.message : '불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [token, navigate])

  const filtered = posts.filter(
    (p) =>
      !q.trim() ||
      p.title.includes(q.trim()) ||
      p.mentions.some((m) => m.product.includes(q.trim())),
  )

  return (
    <AppShell>
      <Breadcrumb items={[{ label: '소비자 동향', to: '/trends' }, { label: '게시글 리스트' }]} />

      <PageHeader title="게시글 리스트">소비자 동향 전체 게시글</PageHeader>

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

      {loading ? (
        <Notice>게시글을 불러오는 중입니다…</Notice>
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <div className="tr-post-list">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {filtered.length === 0 && <EmptyState>조건에 맞는 게시글이 없습니다.</EmptyState>}
        </div>
      )}
    </AppShell>
  )
}
