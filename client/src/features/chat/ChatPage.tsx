import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getChatHistory, getMe, postChat, type ChatSource, type Me } from '../../lib/api'
import AppShell from '../../components/AppShell'
import { SendIcon } from '../../components/icons'
import './chat.css'

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  sources?: ChatSource[]
}

export default function ChatPage() {
  const navigate = useNavigate()
  const token = localStorage.getItem('access_token')

  const [me, setMe] = useState<Me | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  // 대화(thread) id 는 localStorage 에 보존 → 새로고침·재진입해도 같은 thread 로 이어져
  // 백엔드 PostgresSaver 가 대화 기억을 유지한다. '새 대화'로만 초기화.
  const [threadId, setThreadId] = useState<string | null>(() =>
    localStorage.getItem('chat_thread_id'),
  )
  // 제품 카테고리 선택 인터럽트
  const [pending, setPending] = useState<{ message: string; options: string[] } | null>(null)
  const [error, setError] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  // 인사말에 쓸 실제 사용자 이름(회원가입 시 입력, DB 보관)을 불러온다.
  useEffect(() => {
    if (!token) return
    let active = true
    getMe(token)
      .then((m) => active && setMe(m))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [token])

  // 이름이 있으면 "{이름}님", 없으면 기존 기본값 "영업님"
  const greetingName = me?.name?.trim() || '영업'

  // 마운트 시 저장된 thread 의 지난 대화를 화면에 복원
  useEffect(() => {
    if (!token || !threadId) return
    let active = true
    setRestoring(true)
    getChatHistory(token, threadId)
      .then((r) => {
        if (active && r.messages.length) setMessages(r.messages.map((m) => ({ role: m.role, text: m.text })))
      })
      .catch(() => {})
      .finally(() => active && setRestoring(false))
    return () => {
      active = false
    }
    // threadId 최초값만 기준(새 대화/응답 후 재조회 불필요)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading, pending])

  const hasConversation = messages.length > 0

  async function ask(body: { question?: string; resume?: string }, userBubble?: string) {
    if (!token || loading) return
    if (userBubble) setMessages((m) => [...m, { role: 'user', text: userBubble }])
    setPending(null)
    setError('')
    setLoading(true)
    try {
      const r = await postChat(token, { ...body, thread_id: threadId ?? undefined })
      setThreadId(r.thread_id)
      localStorage.setItem('chat_thread_id', r.thread_id)
      if (r.status === 'interrupted') {
        setPending({ message: r.message ?? '추가 입력이 필요합니다.', options: r.options ?? [] })
      } else {
        setMessages((m) => [...m, { role: 'ai', text: r.answer ?? '', sources: r.sources ?? [] }])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '답변을 생성하지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }

  function send() {
    const q = input.trim()
    if (!q) return
    setInput('')
    ask({ question: q }, q)
  }

  function chooseCategory(opt: string) {
    ask({ resume: opt }, opt)
  }

  function newChat() {
    if (loading) return
    setMessages([])
    setPending(null)
    setError('')
    setInput('')
    setThreadId(null)
    localStorage.removeItem('chat_thread_id')
  }

  const composer = (
    <div className="chat-composer">
      <input
        type="text"
        placeholder="무엇이든 물어보세요"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && send()}
        disabled={loading}
      />
      <button type="button" className="chat-send" onClick={send} disabled={loading || !input.trim()}>
        <SendIcon size={18} />
      </button>
    </div>
  )

  // 아직 대화가 없고 복원/응답 중이 아니면 환영 화면
  if (!hasConversation && !loading && !pending && !restoring) {
    return (
      <AppShell>
        <div className="chat-welcome">
          <h1>{greetingName}님, 안녕하세요. 무엇을 도와드릴까요?</h1>
          {composer}
          <div className="chat-welcome-glow" aria-hidden />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="chat-layout">
        <div className="chat-topbar">
          <button type="button" className="chat-newchat" onClick={newChat} disabled={loading}>
            + 새 대화
          </button>
        </div>
        <div className="chat-thread">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="chat-row user">
                  <div className="chat-bubble">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="chat-row ai">
                  <div className="chat-ai">
                    <div className="chat-md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                    </div>
                    {m.sources && m.sources.length > 0 && (
                      <details className="chat-sources">
                        <summary>출처 {m.sources.length}건</summary>
                        <ul>
                          {m.sources.map((s, j) => (
                            <li key={j}>
                              <span className={`chat-src-chip src-${s.source}`}>{s.source_label}</span>
                              <span className="chat-src-snippet">{s.snippet}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ),
            )}

            {pending && (
              <div className="chat-row ai">
                <div className="chat-ai">
                  <div className="chat-md">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{pending.message}</ReactMarkdown>
                  </div>
                  <div className="chat-options">
                    {pending.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className="chat-option"
                        onClick={() => chooseCategory(opt)}
                        disabled={loading}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && (
              <div className="chat-row ai">
                <div className="chat-ai">
                  <div className="chat-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            {error && <div className="chat-error">{error}</div>}
            <div ref={bottomRef} />
        </div>
        <div className="chat-bottom">{composer}</div>
      </div>
    </AppShell>
  )
}
