import { ChevronDownIcon } from './icons'

export interface FilterOption {
  value: string
  label: string
}

// 알약형 필터 드롭다운(.sm-dept) 공용 컴포넌트.
// 열림 상태는 부모가 소유한다(한 번에 하나만 열리도록 + 바깥클릭 닫기를 부모 ref/useDismiss 로 처리).
// 뉴스(회사·유형)·세일즈 메모(팀·거래처) 필터에서 공용으로 쓴다.
export default function FilterDropdown({
  label,
  open,
  onToggle,
  options,
  active,
  onSelect,
  disabled = false,
}: {
  label: string
  open: boolean
  onToggle: () => void
  options: FilterOption[]
  active: string
  onSelect: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="sm-dept">
      <button
        type="button"
        className="sm-chip-pill"
        onClick={onToggle}
        aria-expanded={open}
        disabled={disabled}
      >
        {label} <ChevronDownIcon size={14} />
      </button>
      {open && (
        // 좁은 화면에서 메뉴가 뷰포트를 넘지 않도록 폭을 캡한다(계정 메뉴와 동일 규칙).
        <div className="sm-dept-menu" role="menu" style={{ maxWidth: 'calc(100vw - 32px)' }}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`sm-dept-item${o.value === active ? ' active' : ''}`}
              role="menuitem"
              onClick={() => onSelect(o.value)}
            >
              {o.value === active ? '✓ ' : ''}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
