import { useTheme } from '../useTheme'
import { MoonIcon, SunIcon } from './icons'
import './ThemeToggle.css'

// 로그인/회원가입 화면용 떠있는 테마 토글. (메일함은 햄버거 메뉴에서 전환)
export default function ThemeToggle() {
  const [theme, toggle] = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggle}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      title={isDark ? '라이트 모드' : '다크 모드'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
