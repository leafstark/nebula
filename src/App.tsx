import { useState, useEffect } from "react"
import { Select } from "antd"
import "antd/dist/reset.css"
import SessionList, { type Session } from "./components/SessionList"
import ChatWindow from "./components/ChatWindow"
import ChatInput from "./components/ChatInput"
import RenameModal from "./components/RenameModal"

const MODEL_LIST = [
  "gpt-4o",
  "gpt-4.1",
  "claude-3.5-sonnet",
  "claude-3.7-sonnet",
  "claude-3.7-sonnet-thought",
  "gemini-2.5-pro",
]

function App() {
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: 1,
      name: "默认会话",
      messages: [
        {
          role: "assistant",
          content: "你好！我是 Tiger GPT，有什么可以帮你？",
        },
      ],
    },
  ])
  const [activeSessionId, setActiveSessionId] = useState(1)
  const [input, setInput] = useState("")
  const [model, setModel] = useState(MODEL_LIST[0])
  const [isInitialized, setIsInitialized] = useState(false)
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // 历史记录持久化
  useEffect(() => {
    const saved = localStorage.getItem("tiger-gpt-sessions")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // 只有当 parsed 是有效数组且有内容时才恢复
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed)
          // 恢复上次活跃会话id
          const lastId = localStorage.getItem("tiger-gpt-active-session-id")
          if (lastId && parsed.some((s) => s.id === Number(lastId))) {
            setActiveSessionId(Number(lastId))
          } else {
            setActiveSessionId(parsed[0].id)
          }
        }
      } catch {
        // ignore
      }
    }
    setIsInitialized(true)
  }, [])

  useEffect(() => {
    if (!isInitialized) return
    try {
      localStorage.setItem("tiger-gpt-sessions", JSON.stringify(sessions))
    } catch (e) {
      if (e instanceof Error && e.name === "QuotaExceededError") {
        alert("存储空间已满，请删除部分历史会话后重试。")
      }
    }
  }, [sessions, isInitialized])

  useEffect(() => {
    if (!isInitialized) return
    localStorage.setItem("tiger-gpt-active-session-id", String(activeSessionId))
  }, [activeSessionId, isInitialized])

  // 新建会话
  const handleNewSession = () => {
    const newId = Date.now()
    setSessions([
      { id: newId, name: `新会话${sessions.length + 1}`, messages: [] },
      ...sessions,
    ])
    setActiveSessionId(newId)
  }
  // 切换会话
  const handleSelectSession = (id: number) => setActiveSessionId(id)
  // 删除会话
  const handleDeleteSession = (id: number) => {
    setSessions((sessions) => {
      const filtered = sessions.filter((s) => s.id !== id)
      // 如果删除的是当前会话，切换到下一个或上一个
      if (id === activeSessionId) {
        if (filtered.length > 0) {
          setActiveSessionId(filtered[0].id)
        } else {
          // 没有会话则新建一个
          const newSession = { id: Date.now(), name: "新会话", messages: [] }
          setActiveSessionId(newSession.id)
          return [newSession]
        }
      }
      return filtered
    })
  }

  const handleRenameSession = (id: number, name: string) => {
    setRenameSessionId(id)
    setRenameValue(name)
    setRenameModalVisible(true)
  }

  const handleRenameOk = () => {
    if (!renameSessionId || !renameValue.trim()) return
    setSessions((sessions) =>
      sessions.map((s) =>
        s.id === renameSessionId ? { ...s, name: renameValue.trim() } : s
      )
    )
    setRenameModalVisible(false)
  }

  const handleRenameCancel = () => {
    setRenameModalVisible(false)
  }

  // 发送消息（接入API，流式回复）
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setSessions((sessions) =>
      sessions.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [...s.messages, { role: "user", content: input }],
            }
          : s
      )
    )
    const userMsg = input
    setInput("")
    setSessions((sessions) =>
      sessions.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: [...s.messages, { role: "assistant", content: "" }],
            }
          : s
      )
    )
    // API 流式调用
    try {
      const current = sessions.find((s) => s.id === activeSessionId)
      const res = await fetch(
        "https://wings-copilot.test.tigerbrokers.net/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            stream: true,
            messages: [
              ...(current?.messages || []),
              { role: "user", content: userMsg },
            ],
          }),
        }
      )
      if (!res.body) throw new Error("No stream")
      const reader = res.body.getReader()
      let acc = ""
      let done = false
      let partial = ""
      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          partial += new TextDecoder().decode(value)
          const lastNewline = partial.lastIndexOf("\n")
          if (lastNewline === -1) continue
          const lines = partial
            .slice(0, lastNewline)
            .split(/\r?\n/)
            .filter(Boolean)
          partial = partial.slice(lastNewline + 1)
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.replace("data: ", "").trim()
              if (data === "[DONE]") continue
              try {
                const delta = JSON.parse(data).choices?.[0]?.delta?.content
                if (delta) acc += delta
              } catch {
                // ignore
              }
            }
          }
          // 更新 assistant 最后一条消息内容
          setSessions((sessions) =>
            sessions.map((s) => {
              if (s.id !== activeSessionId) return s
              const msgs = [...s.messages]
              const lastIdx = msgs.length - 1
              if (msgs[lastIdx]?.role === "assistant") {
                msgs[lastIdx] = { role: "assistant", content: acc }
              }
              return { ...s, messages: msgs }
            })
          )
        }
      }
    } catch {
      setSessions((sessions) =>
        sessions.map((s) => {
          if (s.id !== activeSessionId) return s
          const msgs = [...s.messages]
          const lastIdx = msgs.length - 1
          if (msgs[lastIdx]?.role === "assistant") {
            msgs[lastIdx] = { role: "assistant", content: "[网络错误]" }
          }
          return { ...s, messages: msgs }
        })
      )
    }
  }
  // 当前会话
  const current = sessions.find((s) => s.id === activeSessionId)
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-white to-blue-200 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* 顶部导航栏 */}
      <header className="w-full flex items-center justify-between px-8 py-4 border-b border-blue-200 dark:border-blue-900 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold tracking-tight text-blue-600 dark:text-blue-400 drop-shadow">
            TigerAI Hub
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* 模型选择器 */}
          <Select
            value={model}
            onChange={setModel}
            style={{ minWidth: 160 }}
            popupMatchSelectWidth={false}
            options={MODEL_LIST.map((m) => ({ label: m, value: m }))}
          />
        </div>
      </header>
      {/* 主体区域 */}
      <main className="flex-1 flex flex-row overflow-hidden">
        {/* 侧边栏：会话列表 */}
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
        {/* 聊天主窗口 */}
        <section className="flex-1 flex flex-col justify-end bg-transparent relative min-h-0 h-[calc(100vh-70px)]">
          <ChatWindow messages={current?.messages || []} />
          {/* 输入栏 */}
          <ChatInput input={input} setInput={setInput} onSend={handleSend} />
        </section>
      </main>
      {/* 会话重命名弹窗 */}
      <RenameModal
        visible={renameModalVisible}
        value={renameValue}
        setValue={setRenameValue}
        onOk={handleRenameOk}
        onCancel={handleRenameCancel}
      />
    </div>
  )
}

export default App
