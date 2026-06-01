import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ThemeToggle from './components/ThemeToggle'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'

function App() {
  // 메일함(/)은 햄버거 메뉴 안에서 테마를 전환하므로 떠있는 토글을 숨긴다.
  const { pathname } = useLocation()

  return (
    <>
      {pathname !== '/' && <ThemeToggle />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
