import type { ReactNode } from 'react'

// 대시보드 페이지 상단 인사말/제목 영역(.dash-greeting) 공용 컴포넌트.
// title 은 h1, subtitle(children)은 p 로 렌더한다(없으면 p 생략).
export default function PageHeader({
  title,
  children,
}: {
  title: string
  children?: ReactNode
}) {
  return (
    <div className="dash-greeting">
      <h1>{title}</h1>
      {children != null && children !== false && <p>{children}</p>}
    </div>
  )
}
