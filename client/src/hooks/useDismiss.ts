import { useEffect, type RefObject } from 'react'

// 바깥 클릭 + ESC 로 닫히는 팝오버/드롭다운/메뉴 공용 훅.
// 여러 화면(사이드바 계정 메뉴, 뉴스/세일즈 메모 필터 드롭다운)에서 반복되던
// mousedown/keydown 리스너 등록·해제 로직을 한곳으로 모은다.
//
// active 가 true 일 때만 리스너를 건다. ref 바깥을 누르거나 ESC 를 누르면 onDismiss 호출.
export function useDismiss(
  active: boolean,
  ref: RefObject<HTMLElement | null>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [active, ref, onDismiss])
}
