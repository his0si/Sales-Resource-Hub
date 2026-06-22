import type { ReactNode } from 'react'

// 카드 안 비어있음/안내 메시지(.dash-card > .dash-placeholder) 공용 컴포넌트.
export default function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="dash-card">
      <div className="dash-placeholder">{children}</div>
    </div>
  )
}

// 카드 없이 단독으로 쓰는 로딩/에러/안내 한 줄 메시지.
export function Notice({
  tone = 'muted',
  children,
}: {
  tone?: 'muted' | 'error'
  children: ReactNode
}) {
  return <p className={`state-note ${tone}`}>{children}</p>
}
