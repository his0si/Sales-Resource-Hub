import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSalesMemo,
  getSalesMemoBoard,
  getSalesMemoBriefing,
  getSalesMemoSummary,
  type MemoBoardItem,
  type SalesMemo,
} from '../api'
import AppShell from '../components/AppShell'
import {
  ChevronDownIcon,
  CloseIcon,
  ExternalLinkIcon,
  SearchIcon,
  SparkleIcon,
} from '../components/icons'
import MemoTable from '../components/MemoTable'
import '../components/trends.css'
import '../components/salesmemo.css'

// 부서 필터 모드: 'mine'(본인 부서 우선·기본) | 카테고리명 | '전체'
const MINE = 'mine'

export default function SalesMemoBoard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')

  const [departments, setDepartments] = useState<string[]>([])
  const [myDept, setMyDept] = useState('')
  const [filter, setFilter] = useState<string>(MINE)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<MemoBoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  const [briefing, setBriefing] = useState('')
  const [briefingErr, setBriefingErr] = useState('')

  // 카드 펼침 AI 요약
  const [openSummary, setOpenSummary] = useState<number | null>(null)
  const [summaries, setSummaries] = useState<Record<number, string[]>>({})
  const [summaryErr, setSummaryErr] = useState<number | null>(null)

  function toggleSummary(item: MemoBoardItem) {
    const id = item.id
    if (openSummary === id) {
      setOpenSummary(null)
      return
    }
    setOpenSummary(id)
    // 보드 응답에 미리 생성된 요약이 있으면 즉시 표시(요청 불필요)
    if (!token || summaries[id] || item.summary.length) return
    setSummaryErr(null)
    getSalesMemoSummary(token, id)
      .then((r) => setSummaries((prev) => ({ ...prev, [id]: r.summary })))
      .catch(() => setSummaryErr(id))
  }

  // 원문 모달
  const [openMemo, setOpenMemo] = useState<SalesMemo | null>(null)
  const [memoLoading, setMemoLoading] = useState(false)

  function openOriginal(id: number) {
    if (!token) return
    setMemoLoading(true)
    setOpenMemo(null)
    getSalesMemo(token, id)
      .then(setOpenMemo)
      .catch(() => setOpenMemo(null))
      .finally(() => setMemoLoading(false))
  }

  // AI 브리핑은 최초 1회 로드(생성에 수 초 소요 → 비동기)
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    getSalesMemoBriefing(token)
      .then((b) => setBriefing(b.briefing))
      .catch(() => setBriefingErr('AI 브리핑을 불러오지 못했습니다.'))
  }, [token, navigate])

  // 필터가 바뀔 때마다 보드 재조회 (부서 목록·본인 부서도 응답에서 받음)
  useEffect(() => {
    if (!token) return
    let active = true
    const dept = filter === MINE ? undefined : filter
    getSalesMemoBoard(token, dept)
      .then((r) => {
        if (!active) return
        setItems(r.items)
        setDepartments(r.departments)
        setMyDept(r.my_department)
        setError('')
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : '메모를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [token, filter])

  // 드롭다운 바깥 클릭/ESC 닫기
  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // 원문 모달 ESC 닫기
  useEffect(() => {
    if (!openMemo && !memoLoading) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMemo(null)
        setMemoLoading(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openMemo, memoLoading])

  function pick(value: string) {
    setFilter(value)
    setMenuOpen(false)
  }

  function closeModal() {
    setOpenMemo(null)
    setMemoLoading(false)
  }

  const filterLabel =
    filter === MINE ? `본인 부서: ${myDept || '…'}` : filter === '전체' ? '전체' : filter

  const filtered = items.filter(
    (m) =>
      !q.trim() ||
      m.title.includes(q.trim()) ||
      m.author.includes(q.trim()) ||
      m.tags.some((t) => t.includes(q.trim())),
  )

  return (
    <AppShell>
      <div className="dash-greeting">
        <h1>세일즈 메모</h1>
        <p>본인 부서 메모 우선 · 본문은 사내 메일 원문으로 연결</p>
      </div>

      <div className="tr-ai-banner">
        <span className="dash-ai-label">AI 위클리 브리핑 · 최근 7일</span>
        {briefing ? (
          <p>{briefing}</p>
        ) : briefingErr ? (
          <p style={{ color: '#717182' }}>{briefingErr}</p>
        ) : (
          <p style={{ color: '#717182' }}>AI가 최근 메모를 요약하는 중입니다…</p>
        )}
      </div>

      <div className="tr-filterbar">
        <div className="sm-dept" ref={menuRef}>
          <button
            type="button"
            className="tr-filter-pill"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
          >
            {filterLabel} <ChevronDownIcon size={14} />
          </button>
          {menuOpen && (
            <div className="sm-dept-menu" role="menu">
              <button
                type="button"
                className={`sm-dept-item${filter === MINE ? ' active' : ''}`}
                onClick={() => pick(MINE)}
              >
                {filter === MINE ? '✓ ' : ''}
                본인 부서: {myDept}
              </button>
              {departments
                .filter((c) => c !== myDept)
                .map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`sm-dept-item${filter === c ? ' active' : ''}`}
                    onClick={() => pick(c)}
                  >
                    {filter === c ? '✓ ' : ''}
                    {c}
                  </button>
                ))}
              <button
                type="button"
                className={`sm-dept-item${filter === '전체' ? ' active' : ''}`}
                onClick={() => pick('전체')}
              >
                {filter === '전체' ? '✓ ' : ''}
                전체
              </button>
            </div>
          )}
        </div>

        <div className="tr-filter-right">
          <div className="tr-filter-search">
            <SearchIcon />
            <input
              type="search"
              placeholder="제품·지역·이슈 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading && <div className="dash-card"><div className="dash-placeholder">불러오는 중…</div></div>}
      {error && <div className="auth-msg error">{error}</div>}

      {!loading && !error && (
        <div className="sm-list">
          {filtered.length === 0 && (
            <div className="dash-card">
              <div className="dash-placeholder">해당 부서의 메모가 없습니다.</div>
            </div>
          )}
          {filtered.map((m) => (
            <article key={m.id} className={`sm-card${openSummary === m.id ? ' open' : ''}`}>
              <div
                className="sm-card-row"
                role="button"
                tabIndex={0}
                aria-expanded={openSummary === m.id}
                onClick={() => toggleSummary(m)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleSummary(m)
                  }
                }}
              >
                <span className={`sm-dot${m.unread ? ' unread' : ''}`} aria-hidden />
                <div className="sm-body">
                  <div className="sm-title-row">
                    <span className="sm-title">{m.title}</span>
                    {m.own && <span className="sm-badge">본인 부서</span>}
                  </div>
                  <div className="sm-meta">
                    <span>{m.author}</span>
                    {m.dept && (
                      <>
                        <span>·</span>
                        <span>{m.dept}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{m.date}</span>
                  </div>
                  {m.tags.length > 0 && (
                    <div className="sm-tags">
                      {m.tags.map((t) => (
                        <span key={t} className="dash-hashtag">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="sm-row-actions">
                  <button
                    type="button"
                    className="sm-link"
                    onClick={(e) => {
                      e.stopPropagation()
                      openOriginal(m.id)
                    }}
                  >
                    <ExternalLinkIcon size={14} /> 원문
                  </button>
                  <ChevronDownIcon
                    size={16}
                  />
                </span>
              </div>

              {openSummary === m.id &&
                (() => {
                  const bullets =
                    summaries[m.id] ?? (m.summary.length ? m.summary : null)
                  return (
                    <div className="sm-summary">
                      <div className="sm-summary-head">
                        <SparkleIcon size={15} /> AI 개요
                      </div>
                      {bullets ? (
                        <ul className="sm-summary-list">
                          {bullets.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      ) : summaryErr === m.id ? (
                        <p className="sm-summary-msg">요약을 불러오지 못했습니다.</p>
                      ) : (
                        <p className="sm-summary-msg">AI가 메모를 요약하는 중…</p>
                      )}
                    </div>
                  )
                })()}
            </article>
          ))}
        </div>
      )}

      {(memoLoading || openMemo) && (
        <div
          className="sm-modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-head">
              <div>
                <div className="sm-modal-title">
                  {openMemo?.customer_name || '메모 원문'}
                </div>
                {openMemo && (
                  <div className="sm-modal-sub">
                    {[openMemo.author_name, openMemo.written_at?.slice(0, 10)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="sm-modal-close"
                onClick={closeModal}
                aria-label="닫기"
              >
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="sm-modal-body">
              {memoLoading && <div className="inbox-empty">불러오는 중…</div>}
              {openMemo && <MemoTable memo={openMemo} />}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
