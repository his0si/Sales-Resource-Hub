import type { SalesMemo } from '../../lib/api'

// "2026-06-04T00:00:00" → "2026-06-04"
function fmtDate(v: string | null): string {
  return v ? v.slice(0, 10) : ''
}

// "2026-06-05T09:14:54" → "2026-06-05 09:14:54"
function fmtDateTime(v: string | null): string {
  if (!v) return ''
  const [d, t] = v.split('T')
  return t ? `${d} ${t.slice(0, 8)}` : d
}

// DB 컬럼으로 원본 HSP Sales Memo 표를 재구성해 보여준다.
export default function MemoTable({ memo }: { memo: SalesMemo }) {
  return (
    <table className="memo-table">
      <tbody>
        <tr>
          <td className="memo-label">거래선</td>
          <td colSpan={3}>{memo.customer_name}</td>
        </tr>
        <tr>
          <td className="memo-label">방문예정일</td>
          <td>{fmtDate(memo.planned_visit_date)}</td>
          <td className="memo-label">방문일</td>
          <td>{fmtDate(memo.visit_date)}</td>
        </tr>
        <tr>
          <td className="memo-label">작성자</td>
          <td>{memo.author_name}</td>
          <td className="memo-label">작성일</td>
          <td>{fmtDateTime(memo.written_at)}</td>
        </tr>
        <tr>
          <td className="memo-label">활동계획</td>
          <td colSpan={3}>{memo.activity_plan}</td>
        </tr>
        <tr>
          <td className="memo-label">전략</td>
          <td colSpan={3}>{memo.strategy}</td>
        </tr>
        <tr>
          <td className="memo-label">운영</td>
          <td colSpan={3}>{memo.operation}</td>
        </tr>
        <tr>
          <td className="memo-label">제품</td>
          <td colSpan={3}>{memo.product}</td>
        </tr>
        <tr>
          <td className="memo-label">개인</td>
          <td colSpan={3}>{memo.personal}</td>
        </tr>
        <tr>
          <td className="memo-label">영업사원 시사점</td>
          <td colSpan={3}>{memo.takeaway}</td>
        </tr>
        <tr>
          <td className="memo-label">팀장 피드백</td>
          <td colSpan={3}>{memo.followup_plan}</td>
        </tr>
      </tbody>
    </table>
  )
}
