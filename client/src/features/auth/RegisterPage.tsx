import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAuthConfig, register } from '../../lib/api'
import AuthVisual from './AuthVisual'
import './auth.css'

// 팀 선택지 폴백(백엔드 /api/auth/config 의 departments 가 단일 출처).
const TEAMS_FALLBACK = ['공간솔루션팀', '영업1팀', '영업2팀', '마케팅팀', 'HRBP', '기타']

export default function Register() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [name, setName] = useState('')
  const [teams, setTeams] = useState<string[]>(TEAMS_FALLBACK)
  const [team, setTeam] = useState(TEAMS_FALLBACK[0])
  const [remember, setRemember] = useState(false)
  const [domains, setDomains] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // 허용 도메인·부서는 백엔드(/api/auth/config)에서 받아온다 — 단일 출처.
  useEffect(() => {
    getAuthConfig()
      .then((c) => {
        setDomains(c.allowed_domains)
        if (c.departments?.length) {
          setTeams(c.departments)
          setTeam(c.departments[0])
        }
      })
      .catch(() => setDomains([]))
  }, [])

  // 회원가입 = 인증 메일 전송. (백엔드는 이메일 링크 방식이라 "인증번호 받기"도 같은 동작)
  async function sendVerification() {
    setError('')
    setDone('')
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    setLoading(true)
    try {
      const res = await register(email, password, name || undefined, team)
      if (remember) localStorage.setItem('saved_email', email)
      setDone(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    void sendVerification()
  }

  const placeholder = domains[0] ? `name@${domains[0]}` : 'kim.sales@hansol.com'

  return (
    <div className="auth">
      <AuthVisual />

      <div className="auth-form-card">
        <form className="auth-form" onSubmit={onSubmit}>
          <h1>회원가입</h1>

          {error && <div className="auth-msg error">{error}</div>}
          {done && (
            <div className="auth-msg ok">
              {done}
              <br />
              메일이 안 보이면 스팸함을 확인해 주세요.
            </div>
          )}

          <div className="auth-fields">
            <div className="auth-field">
              <label htmlFor="email">이메일</label>
              <div className="auth-row">
                <input
                  id="email"
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={placeholder}
                  autoComplete="email"
                  required
                />
                <button
                  className="auth-inline-btn"
                  type="button"
                  onClick={() => void sendVerification()}
                  disabled={loading || !email}
                >
                  {loading ? '전송 중…' : '인증 요청'}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password">비밀번호</label>
              <input
                id="password"
                className="auth-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password-confirm">비밀번호 확인</label>
              <input
                id="password-confirm"
                className="auth-input"
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="auth-row">
              <div className="auth-field">
                <label htmlFor="name">이름</label>
                <input
                  id="name"
                  className="auth-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="김영업"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="team">팀</label>
                <select
                  id="team"
                  className="auth-select"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="auth-remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>아이디 저장</span>
            </label>
          </div>

          <div className="auth-actions">
            <button className="auth-btn auth-btn-primary" type="submit" disabled={loading}>
              {loading ? '보내는 중…' : done ? '인증 메일 다시 보내기' : '회원가입'}
            </button>
            <button
              className="auth-btn auth-btn-outline"
              type="button"
              onClick={() => navigate('/login')}
            >
              로그인
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
