import { useEffect, useState } from 'react'
import { changePassword, getAuthConfig, updateProfile, type Me } from '../api'
import { CloseIcon } from './icons'

type Msg = { type: 'ok' | 'err'; text: string } | null

// 사이드바 설정 → "내 계정" 모달. 비밀번호 변경 / 팀(부서) 변경.
export default function AccountModal({
  me,
  onClose,
  onSaved,
}: {
  me: Me
  onClose: () => void
  onSaved: (updated: Me) => void
}) {
  const token = localStorage.getItem('access_token') ?? ''

  const [teams, setTeams] = useState<string[]>([])
  const [dept, setDept] = useState(me.department ?? '')

  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<Msg>(null)
  const [pwLoading, setPwLoading] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<Msg>(null)

  useEffect(() => {
    getAuthConfig()
      .then((c) => {
        setTeams(c.departments)
        if (!me.department && c.departments[0]) setDept(c.departments[0])
      })
      .catch(() => {})
  }, [me.department])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function onChangePassword() {
    setPwMsg(null)
    if (pw.length < 8) {
      setPwMsg({ type: 'err', text: '새 비밀번호는 8자 이상이어야 합니다.' })
      return
    }
    if (pw !== pw2) {
      setPwMsg({ type: 'err', text: '새 비밀번호가 일치하지 않습니다.' })
      return
    }
    setPwLoading(true)
    try {
      const res = await changePassword(token, cur, pw)
      setPwMsg({ type: 'ok', text: res.message })
      setCur('')
      setPw('')
      setPw2('')
    } catch (e) {
      setPwMsg({ type: 'err', text: e instanceof Error ? e.message : '변경에 실패했습니다.' })
    } finally {
      setPwLoading(false)
    }
  }

  async function onSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const updated = await updateProfile(token, { department: dept })
      onSaved(updated)
      onClose()
    } catch (e) {
      setSaveMsg({ type: 'err', text: e instanceof Error ? e.message : '저장에 실패했습니다.' })
      setSaving(false)
    }
  }

  return (
    <div className="acct-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="acct-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acct-head">
          <span className="acct-title">내 계정</span>
          <button type="button" className="acct-x" onClick={onClose} aria-label="닫기">
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="acct-body">
          <div className="acct-field">
            <label>이름</label>
            <div className="acct-name">{me.name || me.email}</div>
          </div>

          <div className="acct-section">
            <div className="acct-section-title">비밀번호 변경</div>
            <input
              className="acct-input"
              type="password"
              placeholder="현재 비밀번호"
              autoComplete="current-password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
            />
            <input
              className="acct-input"
              type="password"
              placeholder="새 비밀번호"
              autoComplete="new-password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <input
              className="acct-input"
              type="password"
              placeholder="새 비밀번호 확인"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
            />
            {pwMsg && <div className={`acct-msg ${pwMsg.type}`}>{pwMsg.text}</div>}
            <button
              type="button"
              className="acct-btn-sm"
              onClick={onChangePassword}
              disabled={pwLoading || !cur || !pw || !pw2}
            >
              {pwLoading ? '변경 중…' : '변경'}
            </button>
          </div>

          <div className="acct-section">
            <div className="acct-section-title">팀 변경</div>
            <select
              className="acct-select"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="acct-foot">
          {saveMsg && <div className={`acct-msg ${saveMsg.type}`}>{saveMsg.text}</div>}
          <button type="button" className="acct-btn-outline" onClick={onClose}>
            닫기
          </button>
          <button type="button" className="acct-btn-primary" onClick={onSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
