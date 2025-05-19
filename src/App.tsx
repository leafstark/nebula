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
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [input, setInput] = useState("")
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem("tiger-gpt-model")
    return saved && MODEL_LIST.includes(saved) ? saved : MODEL_LIST[0]
  })
  const [isInitialized, setIsInitialized] = useState(false)
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // 历史记录持久化
  useEffect(() => {
    const saved = localStorage.getItem("tiger-gpt-sessions")
    let loadedSessions: Session[] = []
    let newActiveSessionId: number | null = null

    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedSessions = parsed
          setSessions(loadedSessions) // 首先设置会话

          const hashSessionIdStr = window.location.hash.substring(1)
          const hashSessionIdNum = Number(hashSessionIdStr)
          if (
            hashSessionIdStr &&
            loadedSessions.some((s) => s.id === hashSessionIdNum)
          ) {
            newActiveSessionId = hashSessionIdNum
          }
        }
      } catch {
        // 忽略解析错误，视为没有已保存的会话
      }
    }

    if (loadedSessions.length === 0) {
      // 没有加载到或找到会话，确保是新聊天状态
      setActiveSessionId(null)
      if (window.location.hash && window.location.hash !== "#") {
        window.location.hash = "" // 为新聊天状态清除 hash
      }
    } else {
      setActiveSessionId(newActiveSessionId)
    }
    setIsInitialized(true)
  }, []) // 仅在挂载时运行一次

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
    // 当 activeSessionId 变化时，更新 URL hash
    if (activeSessionId !== null) {
      const sessionExists = sessions.find((s) => s.id === activeSessionId)
      if (sessionExists) {
        window.location.hash = `#${activeSessionId}`
      }
      // 如果会话不存在但 activeSessionId 不为 null，
      // 这可能是在删除过程中的瞬时状态。
      // load useEffect 或 delete handler 应正确管理 activeSessionId 的设置。
    } else {
      // 新聊天状态
      if (window.location.hash && window.location.hash !== "#") {
        window.location.hash = "" // 或特定的标记如 #new
      }
    }
  }, [activeSessionId, isInitialized, sessions])

  // 记住用户上次选择的model
  useEffect(() => {
    if (!isInitialized) return
    localStorage.setItem("tiger-gpt-model", model)
  }, [model, isInitialized])

  // 新建会话
  const handleNewSession = () => {
    setActiveSessionId(null) // 切换到新聊天模式
    setInput("") // 清空输入框
  }
  // 切换会话
  const handleSelectSession = (id: number) => {
    setActiveSessionId(id) // 这会触发上面的 useEffect 来更新 URL hash
  }
  // 删除会话
  const handleDeleteSession = (id: number) => {
    setSessions((prevSessions) => {
      const filtered = prevSessions.filter((s) => s.id !== id)
      if (id === activeSessionId) {
        setActiveSessionId(null)
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
    const userInput = input.trim()
    if (!userInput) return

    setInput("") // 清空输入

    let targetSessionId: number
    let messagesForApi: Array<{ role: string; content: string }>

    if (activeSessionId === null) {
      // 新聊天
      const newId = Date.now()
      const newSessionName = userInput.substring(0, 30) || `新会话` // 从第一条消息自动命名
      const newSession: Session = {
        id: newId,
        name: newSessionName,
        messages: [{ role: "user", content: userInput }],
      }
      // 添加新会话，然后一次性添加助手的占位消息
      setSessions((prevSessions) => [
        {
          ...newSession,
          messages: [
            ...newSession.messages,
            { role: "assistant", content: "" },
          ],
        },
        ...prevSessions,
      ])
      setActiveSessionId(newId)
      targetSessionId = newId
      messagesForApi = newSession.messages // API 只发送用户消息
    } else {
      // 已有聊天
      targetSessionId = activeSessionId
      const currentSession = sessions.find((s) => s.id === activeSessionId)
      // 为 API 准备的消息列表包含当前用户输入
      messagesForApi = currentSession
        ? [...currentSession.messages, { role: "user", content: userInput }]
        : [{ role: "user", content: userInput }]

      // 添加用户消息，然后添加助手占位消息
      setSessions((prevSessions) =>
        prevSessions.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                // messagesForApi 已包含新的用户消息
                messages: [
                  ...messagesForApi,
                  { role: "assistant", content: "" },
                ],
              }
            : s
        )
      )
    }

    // API 流式调用
    try {
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
            messages: messagesForApi, // 发送包含最新用户消息的列表
          }),
        }
      )
      if (!res.body) throw new Error("No stream")
      const reader = res.body.getReader()
      let accumulatedResponse = ""
      let done = false
      let partialChunk = ""
      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          partialChunk += new TextDecoder().decode(value)
          const lines = partialChunk.split("\n") // 按换行符分割
          partialChunk = lines.pop() || "" // 保留下一个不完整的行

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.substring(5).trim() // 更稳健地移除 "data: "
              if (data === "[DONE]") continue
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices?.[0]?.delta?.content
                if (delta) {
                  accumulatedResponse += delta
                }
              } catch (err) {
                console.error("解析流数据错误:", err, "数据:", data)
              }
            }
          }
          // 更新 assistant 最后一条消息内容
          setSessions((prevSessions) =>
            prevSessions.map((s) => {
              if (s.id !== targetSessionId) return s
              const msgs = [...s.messages]
              const lastMsg = msgs[msgs.length - 1]
              // 确保最后一条消息是助手的，并且我们正在更新它
              if (lastMsg?.role === "assistant") {
                msgs[msgs.length - 1] = {
                  ...lastMsg,
                  content: accumulatedResponse,
                }
                return { ...s, messages: msgs }
              }
              return s // 如果最后一条不是助手消息（理论上不应发生），则不修改
            })
          )
        }
      }
    } catch (error) {
      console.error("API 调用失败:", error)
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id !== targetSessionId) return s
          const msgs = [...s.messages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg?.role === "assistant") {
            msgs[msgs.length - 1] = { ...lastMsg, content: "[网络错误]" }
            return { ...s, messages: msgs }
          }
          return s
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
          <ChatWindow
            messages={current?.messages || []}
            activeSessionId={activeSessionId}
          />
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
