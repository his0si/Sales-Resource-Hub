import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getInbox,
  getMe,
  getMessage,
  type GmailPart,
  type InboxResult,
  type MailItem,
  type Me,
} from '../api'
import { CloseIcon, LogoutIcon, MenuIcon, MoonIcon, SunIcon } from '../components/icons'
import { useTheme } from '../useTheme'
import '../auth.css'
import '../mail.css'

// Gmail 본문은 base64url 로 인코딩되어 있어 디코딩이 필요하다.
function decodeB64Url(data: string): string {
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

// payload 트리를 훑어 본문을 추출. text/plain 우선, 없으면 text/html 을 텍스트로 변환.
function extractBody(payload?: GmailPart): string {
  if (!payload) return ''
  const plain = findPart(payload, 'text/plain')
  if (plain?.body?.data) return decodeB64Url(plain.body.data)
  const html = findPart(payload, 'text/html')
  if (html?.body?.data) {
    const doc = new DOMParser().parseFromString(decodeB64Url(html.body.data), 'text/html')
    return doc.body.textContent?.trim() ?? ''
  }
  if (payload.body?.data) return decodeB64Url(payload.body.data)
  return ''
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part
  for (const p of part.parts ?? []) {
    const found = findPart(p, mime)
    if (found) return found
  }
  return null
}

export default function Home() {
  const navigate = useNavigate()
  const [theme, toggleTheme] = useTheme()
  const [me, setMe] = useState<Me | null>(null)
  const [inbox, setInbox] = useState<InboxResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 햄버거 메뉴 열림 상태
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // 펼친 메일의 id 와 본문 캐시
  const [openId, setOpenId] = useState<string | null>(null)
  const [bodies, setBodies] = useState<Record<string, string>>({})
  const [bodyLoading, setBodyLoading] = useState(false)

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
    Promise.all([getMe(token), getInbox(token)])
      .then(([meRes, inboxRes]) => {
        setMe(meRes)
        setInbox(inboxRes)
      })
      .catch((err) => {
        // me 조회 실패(토큰 만료/무효)면 로그아웃, 그 외(메일함 오류)는 메시지 표시
        const msg = err instanceof Error ? err.message : '불러오기에 실패했습니다.'
        if (msg.includes('토큰') || msg.includes('인증') || msg.includes('401')) {
          localStorage.removeItem('access_token')
          localStorage.removeItem('email')
          navigate('/login')
          return
        }
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [navigate])

  async function toggle(mail: MailItem) {
    if (openId === mail.id) {
      setOpenId(null)
      return
    }
    setOpenId(mail.id)
    if (bodies[mail.id] !== undefined) return
    const token = localStorage.getItem('access_token')
    if (!token) return
    setBodyLoading(true)
    try {
      const full = await getMessage(token, mail.id)
      const body = extractBody(full.payload) || mail.snippet
      setBodies((prev) => ({ ...prev, [mail.id]: body }))
    } catch {
      setBodies((prev) => ({ ...prev, [mail.id]: '본문을 불러오지 못했습니다.' }))
    } finally {
      setBodyLoading(false)
    }
  }

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('email')
    navigate('/login')
  }

  return (
    <div className="mail-page">
      <header className="mail-header">
        <div className="mail-title">
          <h1>받은 메일함</h1>
          <p className="mail-sub">{inbox?.mailbox ?? 'ai.hansolhomedeco@gmail.com'}</p>
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

      {!loading && !error && inbox && (
        <ul className="mail-list">
          {inbox.messages.length === 0 && <li className="mail-empty">메일이 없습니다.</li>}
          {inbox.messages.map((mail) => (
            <li
              key={mail.id}
              className={`mail-item${mail.unread ? ' unread' : ''}${openId === mail.id ? ' open' : ''}`}
            >
              <button className="mail-row" type="button" onClick={() => toggle(mail)}>
                <span className="mail-from">{mail.from}</span>
                <span className="mail-subject">{mail.subject || '(제목 없음)'}</span>
                <span className="mail-snippet">{mail.snippet}</span>
                <span className="mail-date">{new Date(mail.date).toLocaleString('ko-KR')}</span>
              </button>
              {openId === mail.id && (
                <div className="mail-body">
                  {bodies[mail.id] === undefined && bodyLoading
                    ? '본문 불러오는 중…'
                    : bodies[mail.id]}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
