import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getSalesMemo,
  getSalesMemoBoard,
  getSalesMemoBriefing,
  getSalesMemoSummary,
  type MemoBoardItem,
  type SalesMemo,
} from '../../lib/api'
import AppShell from '../../components/AppShell'
import { ChevronDownIcon, CloseIcon, ExternalLinkIcon, SparkleIcon } from '../../components/icons'
import MemoTable from './MemoTable'
import Pagination from '../../components/Pagination'
import PageHeader from '../../components/PageHeader'
import FilterDropdown, { type FilterOption } from '../../components/FilterDropdown'
import { BriefingPill, BriefingPanel, type BriefingSection } from '../../components/Briefing'
import EmptyState from '../../components/EmptyState'
import { toLines } from '../../lib/format'
import { useDismiss } from '../../hooks/useDismiss'
import '../trends/trends.css'
import './salesmemo.css'

// 팀(부서) 필터 모드: 'mine'(본인 부서 우선·기본) | 부서명 | '전체'
const MINE = 'mine'
const ALL_CUSTOMER = '전체'
const PAGE_SIZE = 10

export default function SalesMemoBoard() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')

  const [departments, setDepartments] = useState<string[]>([])
  const [myDept, setMyDept] = useState('')
  const [filter, setFilter] = useState<string>(MINE) // 팀 필터
  const [customer, setCustomer] = useState<string>(ALL_CUSTOMER) // 거래처 필터
  const [openMenu, setOpenMenu] = useState<'team' | 'customer' | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)
  useDismiss(openMenu !== null, filterRef, () => setOpenMenu(null))

  const [items, setItems] = useState<MemoBoardItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)

  // AI 위클리 브리핑 (좌측 패널, 버튼으로 토글). 기본은 펼침(디자인 기준).
  // 데이터는 백그라운드 생성분(ai_briefing, Ollama) — 선택한 팀(부서)의 주간 브리핑.
  const [briefingText, setBriefingText] = useState('')
  const [briefingErr, setBriefingErr] = useState(false)
  const [briefingOpen, setBriefingOpen] = useState(true)

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

  // AI 위클리 브리핑 로드 — 선택한 팀(부서)의 백그라운드 생성분(ai_briefing) 조회.
  // 'mine'/'전체'는 서버가 본인 부서로 폴백, 특정 팀이면 그 팀 브리핑을 보여준다.
  useEffect(() => {
    if (!token) {
      navigate('/login')
      return
    }
    let active = true
    const dept = filter === MINE || filter === '전체' ? undefined : filter
    setBriefingErr(false)
    getSalesMemoBriefing(token, dept)
      .then((b) => active && setBriefingText(b.briefing))
      .catch(() => active && setBriefingErr(true))
    return () => {
      active = false
    }
  }, [token, navigate, filter])

  // 팀 필터가 바뀔 때마다 보드 재조회 (부서 목록·본인 부서도 응답에서 받음)
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

  function pickTeam(value: string) {
    setFilter(value)
    setCustomer(ALL_CUSTOMER) // 팀이 바뀌면 거래처 필터 초기화
    setOpenMenu(null)
  }

  function pickCustomer(value: string) {
    setCustomer(value)
    setOpenMenu(null)
  }

  function closeModal() {
    setOpenMemo(null)
    setMemoLoading(false)
  }

  const teamLabel =
    filter === MINE ? `팀 · ${myDept || '본인'}` : filter === '전체' ? '팀 · 전체' : `팀 · ${filter}`
  const customerLabel = customer === ALL_CUSTOMER ? '거래처' : `거래처 · ${customer}`

  // 현재 팀 결과 내 거래처 목록(가나다순)
  const customers = useMemo(() => {
    const set = new Set<string>()
    for (const m of items) if (m.customer) set.add(m.customer)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'))
  }, [items])

  // 거래처로 필터
  const filtered = useMemo(
    () => items.filter((m) => customer === ALL_CUSTOMER || m.customer === customer),
    [items, customer],
  )

  // 마지막 업데이트(가장 최근 메모 날짜)
  const lastUpdated = useMemo(() => {
    let max = ''
    for (const m of items) if (m.date > max) max = m.date
    return max
  }, [items])

  // 필터가 바뀌면 1페이지로
  useEffect(() => {
    setPage(1)
  }, [filter, customer])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // 선택한 팀의 주간 브리핑(Ollama 생성분) 불릿
  const briefingLines = toLines(briefingText)
  const briefingDept = filter === MINE || filter === '전체' ? myDept : filter
  const briefingSections: BriefingSection[] =
    briefingLines.length > 0
      ? [{ title: briefingDept ? `${briefingDept} 주간 브리핑` : '주간 브리핑', lines: briefingLines }]
      : []

  const teamOptions: FilterOption[] = [
    { value: MINE, label: `본인 부서: ${myDept}` },
    ...departments.filter((c) => c !== myDept).map((c) => ({ value: c, label: c })),
    { value: '전체', label: '전체' },
  ]
  const customerOptions: FilterOption[] = [
    { value: ALL_CUSTOMER, label: '전체' },
    ...customers.map((c) => ({ value: c, label: c })),
  ]

  return (
    <AppShell>
      <PageHeader title="세일즈 메모">
        {lastUpdated && (
          <>
            마지막 업데이트 <strong className="sm-update">{lastUpdated}</strong>
          </>
        )}
      </PageHeader>

      {/* 상단 바: (좌) AI 위클리 브리핑 버튼  (우) 팀·거래처 필터 + 건수 */}
      <div className="sm-toprow" ref={filterRef}>
        <div className={`sm-col-left${briefingOpen ? ' open' : ''}`}>
          <BriefingPill open={briefingOpen} onToggle={() => setBriefingOpen((o) => !o)} />
        </div>

        <div className="sm-col-right sm-toolbar">
          <div className="sm-filters">
            <FilterDropdown
              label={teamLabel}
              open={openMenu === 'team'}
              onToggle={() => setOpenMenu((m) => (m === 'team' ? null : 'team'))}
              options={teamOptions}
              active={filter}
              onSelect={pickTeam}
            />
            <FilterDropdown
              label={customerLabel}
              open={openMenu === 'customer'}
              onToggle={() => setOpenMenu((m) => (m === 'customer' ? null : 'customer'))}
              options={customerOptions}
              active={customer}
              onSelect={pickCustomer}
              disabled={customers.length === 0}
            />
          </div>

          <span className="sm-count">총 {filtered.length}건</span>
        </div>
      </div>

      {/* 본문: (좌) 브리핑 패널  (우) 메모 카드 */}
      <div className="sm-columns">
        {briefingOpen && (
          <BriefingPanel
            sections={briefingSections}
            emptyText={
              briefingErr ? 'AI 브리핑을 불러오지 못했습니다.' : 'AI가 최근 동향을 요약하는 중입니다…'
            }
          />
        )}

        <div className="sm-col-right">
          {loading && <EmptyState>불러오는 중…</EmptyState>}
          {error && <div className="auth-msg error">{error}</div>}

          {!loading && !error && (
            <>
              <div className="sm-list">
                {pageItems.length === 0 && <EmptyState>해당 조건의 메모가 없습니다.</EmptyState>}
                {pageItems.map((m) => {
                  const open = openSummary === m.id
                  return (
                    <article key={m.id} className={`sm-card${open ? ' open' : ''}`}>
                      <div
                        className="sm-card-row"
                        role="button"
                        tabIndex={0}
                        aria-expanded={open}
                        onClick={() => toggleSummary(m)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleSummary(m)
                          }
                        }}
                      >
                        <div className="sm-title-row">
                          <span className="sm-title">{m.title}</span>
                          <span className="sm-title-right">
                            <span className="sm-date">{m.date}</span>
                            <span className={`sm-caret${open ? ' open' : ''}`}>
                              <ChevronDownIcon size={20} />
                            </span>
                          </span>
                        </div>

                        <div className="sm-meta">
                          {m.dept && <span>{m.dept}</span>}
                          {m.dept && m.author && <span className="sm-sep">|</span>}
                          {m.author && <span>{m.author}</span>}
                        </div>

                        <div className="sm-bottom">
                          <div className="sm-tags">
                            {m.tags.map((t) => (
                              <span key={t} className="sm-hashtag">
                                #{t}
                              </span>
                            ))}
                          </div>
                          <button
                            type="button"
                            className="sm-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              openOriginal(m.id)
                            }}
                          >
                            <ExternalLinkIcon size={14} /> 메모 원문
                          </button>
                        </div>
                      </div>

                      {open &&
                        (() => {
                          const bullets = summaries[m.id] ?? (m.summary.length ? m.summary : null)
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
                  )
                })}
              </div>

              <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
            </>
          )}
        </div>
      </div>

      {(memoLoading || openMemo) && (
        <div className="sm-modal-overlay" role="dialog" aria-modal="true" onClick={closeModal}>
          <div className="sm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sm-modal-head">
              <div>
                <div className="sm-modal-title">{openMemo?.customer_name || '메모 원문'}</div>
                {openMemo && (
                  <div className="sm-modal-sub">
                    {[openMemo.author_name, openMemo.written_at?.slice(0, 10)]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </div>
              <button type="button" className="sm-modal-close" onClick={closeModal} aria-label="닫기">
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
