import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { login } from '../api'
import '../auth.css'

// /api/auth/verify 가 리다이렉트하며 붙여주는 ?verified= 값에 대한 안내문구.
const VERIFY_MSG: Record<string, string> = {
  success: '이메일 인증이 완료되었습니다. 이제 로그인하세요.',
  expired: '인증 링크가 만료되었습니다. 다시 가입해 인증 메일을 받아주세요.',
  invalid: '유효하지 않은 인증 링크입니다.',
}

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const verified = params.get('verified')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(email, password)
      localStorage.setItem('access_token', res.access_token)
      localStorage.setItem('email', res.email)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>로그인</h1>
        <p className="auth-sub">한솔홈데코 HRBP(AX)</p>

        {verified && VERIFY_MSG[verified] && (
          <div className={`auth-msg ${verified === 'success' ? 'ok' : 'error'}`}>
            {VERIFY_MSG[verified]}
          </div>
        )}
        {error && <div className="auth-msg error">{error}</div>}

        <form className="auth-form" onSubmit={onSubmit}>
          <label>
            이메일
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>

        <p className="auth-foot">
          계정이 없나요? <Link to="/register">회원가입</Link>
        </p>
      </div>
    </div>
  )
}
