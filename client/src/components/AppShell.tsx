import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { getMe, type Me } from '../lib/api'
import AccountModal from './AccountModal'
import {
  BotIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  NewspaperIcon,
  NoteIcon,
  SearchIcon,
  SettingsIcon,
  TrendIcon,
  UserIcon,
} from './icons'
import hansolMark from '../assets/hansol-logo-mark.svg'
import './app.css'

// 모든 대시보드 화면(홈/소비자 동향/뉴스/세일즈 메모)이 공유하는 앱 셸.
// 좌측 사이드바 + 상단 검색바 + 본문(children). 토큰이 없으면 /login 으로 보낸다.
export default function AppShell({
  children,
  lastUpdated = '06.04 06:00',
}: {
  children: ReactNode
  lastUpdated?: string
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [me, setMe] = useState<Me | null>(null)
  // 소비자 동향 하위 메뉴 펼침 — 해당 경로에 있으면 기본 펼침.
  const [trendsOpen, setTrendsOpen] = useState(pathname.startsWith('/trends'))
  // 사이드바 접기(아이콘 레일) — 로컬에 기억
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === '1',
  )
  // 모바일 사이드바 드로어 열림 — 라우트 바뀌면 자동으로 닫힘
  const [mobileOpen, setMobileOpen] = useState(false)
  // 상단 통합 검색어
  const [search, setSearch] = useState('')
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])
  // 설정(톱니) 계정 메뉴 + 내 계정 모달
  const [accountMenu, setAccountMenu] = useState(false)
  const [accountModal, setAccountModal] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }
    getMe(token)
      .then(setMe)
      .catch(() => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('email')
        navigate('/login')
      })
  }, [navigate])

  // 계정 메뉴 바깥 클릭 / ESC 닫기
  useEffect(() => {
    if (!accountMenu) return
    function onClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountMenu(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAccountMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [accountMenu])

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem('sidebar_collapsed', c ? '0' : '1')
      return !c
    })
    setAccountMenu(false)
  }

  // 통합 검색 제출 → /search?q= 결과 페이지로 이동
  function submitSearch(e: FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('email')
    navigate('/login')
  }

  // 회원가입 때 받은 이름/부서를 표시 (없으면 이메일 로컬파트로 폴백)
  const accountName = me?.name || (me?.email ? me.email.split('@')[0] : '사용자')
  const accountDept = me?.department || '사내 계정'

  return (
    <div className={`app${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="app-backdrop" onClick={() => setMobileOpen(false)} aria-hidden />
      <aside className="app-sidebar">
        <div className="app-brand">
          <img className="app-brand-logo" src={hansolMark} alt="Hansol 한솔홈데코" />
          <span className="app-brand-title">세일즈 리소스 허브</span>
        </div>

        <nav className="app-nav">
          <NavLink to="/" end className="app-nav-item">
            <HomeIcon />
            <span>홈</span>
          </NavLink>

          <div className="app-nav-group">
            <button
              type="button"
              className={`app-nav-item${pathname.startsWith('/trends') ? ' active' : ''}`}
              onClick={() => setTrendsOpen((o) => !o)}
              aria-expanded={trendsOpen}
            >
              <TrendIcon />
              <span>소비자 동향</span>
              <span className={`app-nav-chevron${trendsOpen ? ' open' : ''}`}>
                <ChevronDownIcon size={14} />
              </span>
            </button>
            {trendsOpen && (
              <ul className="app-subnav">
                <li>
                  <NavLink to="/trends/products" className="app-subnav-item">
                    제품 리스트
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/trends/posts" className="app-subnav-item">
                    게시글 리스트
                  </NavLink>
                </li>
              </ul>
            )}
          </div>

          <NavLink to="/news" className="app-nav-item">
            <NewspaperIcon />
            <span>뉴스</span>
          </NavLink>

          <NavLink to="/sales-memo" className="app-nav-item">
            <NoteIcon />
            <span>세일즈 메모</span>
          </NavLink>

          <NavLink to="/chat" className="app-nav-item">
            <BotIcon />
            <span>AI 챗봇</span>
          </NavLink>
        </nav>

        <div className="app-user">
          <div className="app-user-info">
            <span className="app-user-name">{accountName}</span>
            <span className="app-user-team">{accountDept}</span>
          </div>
          <div className="app-user-actions">
            <div className="app-account" ref={accountRef}>
              <button
                type="button"
                className="app-icon-btn"
                title="설정"
                aria-label="설정"
                aria-expanded={accountMenu}
                onClick={() => setAccountMenu((o) => !o)}
              >
                <SettingsIcon />
              </button>
              {accountMenu && (
                <div className="app-account-menu" role="menu">
                  {me && (
                    <div className="app-account-head">
                      <span className="app-account-name">{accountName}</span>
                      <span className="app-account-email">{me.email}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className="app-account-item"
                    role="menuitem"
                    onClick={() => {
                      setAccountMenu(false)
                      setMobileOpen(false)
                      setAccountModal(true)
                    }}
                  >
                    <UserIcon size={17} />내 계정
                  </button>
                  <button
                    type="button"
                    className="app-account-item danger"
                    role="menuitem"
                    onClick={logout}
                  >
                    <LogoutIcon size={17} />로그아웃
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              className="app-icon-btn app-collapse-btn"
              title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
              aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
              onClick={toggleCollapsed}
            >
              {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeftIcon size={16} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="app-main-col">
        <header className="app-topbar">
          <button
            type="button"
            className="app-burger"
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
          >
            <MenuIcon size={22} />
          </button>
          <div className="app-mobile-brand">
            <img className="app-mobile-brand-logo" src={hansolMark} alt="Hansol 한솔홈데코" />
            <span className="app-mobile-brand-title">세일즈 리소스 허브</span>
          </div>
          <form className="app-search" onSubmit={submitSearch} role="search">
            <button type="submit" className="app-search-btn" aria-label="검색">
              <SearchIcon />
            </button>
            <input
              type="search"
              placeholder="제품·뉴스·메모 통합 검색"
              aria-label="통합 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <span className="app-updated">마지막 업데이트: {lastUpdated}</span>
        </header>

        <main className="app-main">{children}</main>
      </div>

      {accountModal && me && (
        <AccountModal me={me} onClose={() => setAccountModal(false)} onSaved={setMe} />
      )}
    </div>
  )
}
