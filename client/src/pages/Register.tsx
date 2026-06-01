import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAuthConfig, register } from '../api'
import '../auth.css'

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [domains, setDomains] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  // 허용 도메인은 백엔드(/api/auth/config)에서 받아온다 — 도메인 단일 출처.
  useEffect(() => {
    getAuthConfig()
      .then((c) => setDomains(c.allowed_domains))
      .catch(() => setDomains([]))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone('')
    setLoading(true)
    try {
      const res = await register(email, password)
      setDone(res.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const hint = domains.length ? domains.map((d) => `@${d}`).join(' 또는 ') : ''

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>회원가입</h1>
        <p className="auth-sub">
          {hint ? `${hint} 이메일만 가입할 수 있습니다.` : '학교 이메일로 가입하세요.'}
        </p>

        {error && <div className="auth-msg error">{error}</div>}
        {done && (
          <div className="auth-msg ok">
            {done}
            <br />
            메일이 안 보이면 스팸함을 확인하거나 아래에서 다시 보낼 수 있어요.
          </div>
        )}

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={domains[0] ? `name@${domains[0]}` : 'name@example.com'}
              required
            />
          </label>
          <label>
            비밀번호 (8자 이상)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading
              ? '보내는 중…'
              : done
                ? '인증 메일 다시 보내기'
                : '인증 메일 보내기'}
          </button>
        </form>

        <p className="auth-foot">
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </div>
    </div>
  )
}
