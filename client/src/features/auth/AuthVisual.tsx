import heroKitchen from '../../assets/hero-kitchen.jpg'
import hansolLogo from '../../assets/hansol-logo.svg'

// 로그인/회원가입 좌측 비주얼 카드 (주방 사진 + 로고 + 태그라인). 두 화면이 공유한다.
export default function AuthVisual() {
  return (
    <div className="auth-visual">
      <img className="auth-photo" src={heroKitchen} alt="" />
      <img className="auth-logo" src={hansolLogo} alt="Hansol 한솔홈데코" />
      <div className="auth-tagline">
        <h2>
          We gather the intel.
          <br />
          You make the move.
        </h2>
        <div className="auth-tagline-sub">
          <span className="rule" aria-hidden />
          <span>Sales Resource Hub</span>
        </div>
      </div>
    </div>
  )
}
