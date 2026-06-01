import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMe, type Me } from '../api'
import '../auth.css'

export default function Home() {
  const navigate = useNavigate()
  const [me, setMe] = useState<Me | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      navigate('/login')
      return
    }
    getMe(token)
      .then(setMe)
      .catch(() => {
        // 토큰 만료/무효 -> 정리 후 로그인으로
        localStorage.removeItem('access_token')
        localStorage.removeItem('email')
        navigate('/login')
      })
  }, [navigate])

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('email')
    navigate('/login')
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>환영합니다 🎉</h1>
        {me ? (
          <>
            <p className="auth-sub">로그인된 계정</p>
            <div className="auth-msg ok">{me.email}</div>
            <p className="auth-foot" style={{ marginTop: 8 }}>
              가입일: {new Date(me.created_at).toLocaleString('ko-KR')}
            </p>
          </>
        ) : (
          <p className="auth-sub">불러오는 중…</p>
        )}
        <button className="auth-btn" type="button" onClick={logout} style={{ width: '100%' }}>
          로그아웃
        </button>
      </div>
    </div>
  )
}
