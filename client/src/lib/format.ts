// 공용 포매팅 유틸 — 여러 페이지(뉴스/세일즈 메모/소비자 동향/홈)에서 중복되던
// 날짜·브리핑 텍스트 가공 함수를 한곳에 모은다.

// ISO(또는 이미 'MM.DD' 등으로 포맷된 문자열) → 'MM.DD'.
// 파싱 불가하면 받은 문자열을 그대로 돌려준다(이미 포맷된 값 보존).
export function fmtDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

// 오늘 날짜 'YYYY.MM.DD'
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

interface ToLinesOptions {
  // 최대 줄 수 제한(소비자 동향 배너처럼 미리보기용)
  max?: number
  // 마크다운 강조(**) 제거 — Ollama 브리핑 텍스트 정리용
  stripMarkdown?: boolean
}

// 브리핑 본문(여러 줄, 머리표·이모지·마크다운 섞임) → 정돈된 불릿 줄 배열.
// 줄머리의 '-','•','*','#','>' 와 공백을 제거하고 빈 줄은 버린다.
export function toLines(text: string | null | undefined, opts: ToLinesOptions = {}): string[] {
  if (!text) return []
  const lines = text
    .split('\n')
    .map((l) => {
      let s = l.replace(/^[\s•\-*#>]+/, '')
      if (opts.stripMarkdown) s = s.replace(/\*\*/g, '')
      return s.trim()
    })
    .filter(Boolean)
  return opts.max ? lines.slice(0, opts.max) : lines
}
