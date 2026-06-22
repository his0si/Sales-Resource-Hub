import { ChevronDownIcon, SparkleIcon } from './icons'

// "AI 위클리 브리핑" 토글 버튼(.sm-ai-pill). 뉴스·세일즈 메모 공용.
export function BriefingPill({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className={`sm-ai-pill${open ? ' active' : ''}`}
      onClick={onToggle}
      aria-expanded={open}
    >
      <SparkleIcon size={14} /> AI 위클리 브리핑
      <span className={`sm-caret${open ? ' open' : ''}`}>
        <ChevronDownIcon size={14} />
      </span>
    </button>
  )
}

export interface BriefingSection {
  title: string
  lines: string[]
}

// 좌측 브리핑 패널(.sm-brief-panel). 내용 있는 섹션만 렌더하고,
// 없으면 emptyText(로딩/에러 안내)를 보여준다. 뉴스·세일즈 메모 공용.
export function BriefingPanel({
  sections,
  emptyText,
}: {
  sections: BriefingSection[]
  emptyText: string
}) {
  return (
    <aside className="sm-col-left open sm-brief-panel">
      {sections.length > 0 ? (
        sections.map((s) => (
          <section key={s.title} className="sm-brief-section">
            <h4 className="sm-brief-title">{s.title}</h4>
            <ul className="sm-brief-lines">
              {s.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="sm-brief-empty">{emptyText}</p>
      )}
    </aside>
  )
}
