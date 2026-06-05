import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, getSalesMemos, type Me, type SalesMemo, type SalesMemoResult } from '../api'
import { CloseIcon, LogoutIcon, MenuIcon, MoonIcon, SunIcon } from '../components/icons'
import { useTheme } from '../useTheme'
import '../auth.css'
import '../mail.css'

// "2026-06-04" / "2026-06-04T00:00:00" → "2026-06-04"
function fmtDate(v: string | null): string {
  return v ? v.slice(0, 10) : ''
}

// "2026-06-05T09:14:54" → "2026-06-05 09:14:54"
function fmtDateTime(v: string | null): string {
  if (!v) return ''
  const [d, t] = v.split('T')
  return t ? `${d} ${t.slice(0, 8)}` : d
}

// 목록 미리보기: 채워진 항목의 첫 줄
function previewLine(memo: SalesMemo): string {
  for (const v of [memo.activity_plan, memo.strategy, memo.takeaway, memo.product]) {
    if (v && v.trim()) return v.trim().split('\n')[0]
  }
  return ''
}

// DB 컬럼으로 원본 HSP Sales Memo 표를 재구성해 보여준다.
function MemoTable({ memo }: { memo: SalesMemo }) {
  return (
    <table className="memo-table">
      <tbody>
        <tr>
          <td className="memo-label">거래선</td>
          <td className="memo-value" colSpan={3}>
            {memo.customer_name}
          </td>
        </tr>
        <tr>
          <td className="memo-label">방문예정일</td>
          <td className="memo-value">{fmtDate(memo.planned_visit_date)}</td>
          <td className="memo-label">방문일</td>
          <td className="memo-value">{fmtDate(memo.visit_date)}</td>
        </tr>
        <tr>
          <td className="memo-label">작성자</td>
          <td className="memo-value">{memo.author_name}</td>
          <td className="memo-label">작성일</td>
          <td className="memo-value">{fmtDateTime(memo.written_at)}</td>
        </tr>
        <tr>
          <td className="memo-label">활동계획</td>
          <td className="memo-value" colSpan={3}>
            {memo.activity_plan}
          </td>
        </tr>
        <tr>
          <td className="memo-label">전략</td>
          <td className="memo-value" colSpan={3}>
            {memo.strategy}
          </td>
        </tr>
        <tr>
          <td className="memo-label">운영</td>
          <td className="memo-value" colSpan={3}>
            {memo.operation}
          </td>
        </tr>
        <tr>
          <td className="memo-label">제품</td>
          <td className="memo-value" colSpan={3}>
            {memo.product}
          </td>
        </tr>
        <tr>
          <td className="memo-label">개인</td>
          <td className="memo-value" colSpan={3}>
            {memo.personal}
          </td>
        </tr>
        <tr>
          <td className="memo-label">영업사원 시사점</td>
          <td className="memo-value" colSpan={3}>
            {memo.takeaway}
          </td>
        </tr>
        <tr>
          <td className="memo-label">팀장 피드백</td>
          <td className="memo-value" colSpan={3}>
            {memo.followup_plan}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const [theme, toggleTheme] = useTheme()
  const [me, setMe] = useState<Me | null>(null)
  const [result, setResult] = useState<SalesMemoResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 햄버거 메뉴 열림 상태
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 펼친 메모의 id
  const [openId, setOpenId] = useState<number | null>(null)

  // 메뉴 바깥 클릭 / ESC 로 닫기
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

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }
    // 인증(getMe)과 영업일지(getSalesMemos)를 분리한다.
    //  - getMe 실패 = 토큰 만료/무효 → 로그아웃 후 로그인으로.
    //  - getSalesMemos 실패 = DB 쪽 문제 → 로그인은 유지하고 메시지만 표시.
    getMe(token)
      .then((meRes) => {
        setMe(meRes)
        return getSalesMemos(token)
          .then(setResult)
          .catch((err) => {
            setError(err instanceof Error ? err.message : '영업일지를 불러오지 못했습니다.')
          })
      })
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('email')
        navigate('/login')
      })
      .finally(() => setLoading(false))
  }, [navigate])

  function toggle(id: number) {
    setOpenId((cur) => (cur === id ? null : id))
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('email')
    navigate('/login')
  }

  const memos = result?.memos ?? []

  return (
    <div className="mail-page">
      <header className="mail-header">
        <div className="mail-title">
          <h1>영업일지</h1>
          <p className="mail-sub">
            {result ? `전체 ${result.total}건 · 최신순` : 'ai.hansolhomedeco@gmail.com'}
          </p>
        </div>

        <div className="mail-menu" ref={menuRef}>
          <button
            className="mail-hamburger"
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="메뉴"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>

          {menuOpen && (
            <div className="mail-menu-panel" role="menu">
              {me && (
                <div className="mail-menu-account">
                  <span className="mail-menu-label">로그인 계정</span>
                  <span className="mail-menu-email">{me.email}</span>
                </div>
              )}
              <button
                className="mail-menu-item"
                type="button"
                role="menuitem"
                onClick={toggleTheme}
              >
                {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                {theme === 'dark' ? '라이트 모드' : '다크 모드'}
              </button>
              <button
                className="mail-menu-item danger"
                type="button"
                role="menuitem"
                onClick={logout}
              >
                <LogoutIcon />
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      {loading && <p className="mail-empty">불러오는 중…</p>}
      {error && <div className="auth-msg error">{error}</div>}

      {!loading && !error && result && (
        <ul className="mail-list">
          {memos.length === 0 && <li className="mail-empty">영업일지가 없습니다.</li>}
          {memos.map((memo) => (
            <li
              key={memo.id}
              className={`mail-item${openId === memo.id ? ' open' : ''}`}
            >
              <button className="mail-row" type="button" onClick={() => toggle(memo.id)}>
                <span className="mail-from">{memo.author_name || '작성자 미상'}</span>
                <span className="mail-subject">{memo.customer_name || '(거래선 없음)'}</span>
                <span className="mail-snippet">{previewLine(memo)}</span>
                <span className="mail-date">
                  {fmtDateTime(memo.written_at) || fmtDate(memo.visit_date)}
                </span>
              </button>
              {openId === memo.id && (
                <div className="mail-body">
                  <MemoTable memo={memo} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
