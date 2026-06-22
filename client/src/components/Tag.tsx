import type { ReactNode } from 'react'
import type { TagTone } from '../lib/tags'

// 칩/태그 공용 컴포넌트 (.dash-chip). 'outline' 은 무채색 테두리,
// 그 외 색상 변형(red/azure/green/yellow/violet)은 .tag-* 클래스로 매핑된다.
export default function Tag({ tone = 'outline', children }: { tone?: TagTone; children: ReactNode }) {
  const variant = tone === 'outline' ? 'outline' : `tag-${tone}`
  return <span className={`dash-chip ${variant}`}>{children}</span>
}
