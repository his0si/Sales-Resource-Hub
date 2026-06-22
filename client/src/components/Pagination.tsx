import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import './pagination.css'

// 페이지 윈도우: 1 … (현재-1) 현재 (현재+1) … 마지막 (전부 나열하지 않음)
function pageWindow(cur: number, total: number): (number | '…')[] {
  const set = new Set<number>([1, total, cur, cur - 1, cur + 1])
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  let prev = 0
  for (const n of nums) {
    if (n - prev > 1) out.push('…')
    out.push(n)
    prev = n
  }
  return out
}

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

/** 세일즈 메모·뉴스·소비자 동향 공용 페이지네이션. totalPages<=1 이면 렌더 안 함. */
export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <div className="pager">
      <button
        type="button"
        className="pager-arrow"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
        aria-label="이전 페이지"
      >
        <ChevronLeftIcon size={16} />
      </button>
      <div className="pager-nums">
        {pageWindow(page, totalPages).map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className="pager-ellipsis">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              className={`pager-num${n === page ? ' active' : ''}`}
              onClick={() => onChange(n)}
            >
              {n}
            </button>
          ),
        )}
      </div>
      <button
        type="button"
        className="pager-arrow"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        aria-label="다음 페이지"
      >
        <ChevronRightIcon size={16} />
      </button>
    </div>
  )
}
