import { useState, useEffect } from "react"
import { Select } from "antd"
// import "antd/dist/reset.css"
import SessionList from "./components/SessionList"
import ChatWindow from "./components/ChatWindow"
import ChatInput from "./components/ChatInput"
import RenameModal from "./components/RenameModal"
import { useSessions } from "./hooks/useSessions"
import { useModel } from "./hooks/useModel"
import { useChatStream } from "./hooks/useChatStream"
import type { Message } from "./components/ChatWindow"

function App() {
  // 会话管理
  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    isInitialized,
  } = useSessions()
  // 模型管理
  const { model, setModel, MODEL_LIST } = useModel(isInitialized)
  // 聊天输入与发送
  const { input, setInput, handleSend } = useChatStream({
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    model,
  })

  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // 新增：用于延迟派发 resend 事件，避免 setSessions 闭包导致多次副作用
  const [pendingResend, setPendingResend] = useState<{
    sessionId: number
    messages: Message[]
    userMsg: Message
    model: string
  } | null>(null)

  // 新建会话
  const handleNewSession = () => {
    setActiveSessionId(null)
    setInput("")
  }
  // 切换会话
  const handleSelectSession = (id: number) => {
    setActiveSessionId(id)
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

  // 删除单条消息
  // const handleDeleteMessage = (messageId: number) => {
  //   if (!current) return
  //   setSessions((prevSessions) =>
  //     prevSessions.map((s) =>
  //       s.id === current.id
  //         ? { ...s, messages: s.messages.filter((m) => m.id !== messageId) }
  //         : s
  //     )
  //   )
  // }

  // 重发消息（仅支持重发用户消息，自动删除其后的 assistant 回复）
  const handleResendMessage = (messageId: number) => {
    if (!current) return
    const msgIdx = current.messages.findIndex((m) => m.id === messageId)
    if (msgIdx === -1) return
    const msg = current.messages[msgIdx]
    if (msg.role !== "user") return
    // 删除该用户消息之后的所有消息（含 AI 回复），并直接重发该消息
    // 这里直接调用 useChatStream 的 handleSend 会导致再次插入一条 user 消息
    // 应该直接调用 useChatStream 的底层逻辑，避免重复插入
    // 方案：直接调用 setSessions，插入 assistant 空消息，然后发起请求
    const targetSessionId = current.id
    const userMsg = msg
    // 先移除后续消息并插入 assistant 空消息
    setSessions((prevSessions) =>
      prevSessions.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              messages: [
                ...s.messages.slice(0, msgIdx + 1),
                { role: "assistant", content: "", id: Date.now() + Math.floor(Math.random() * 10000) },
              ],
            }
          : s
      )
    )
    // 直接发起请求（模拟 handleSend 的流式请求部分）
    // 这里需要复用 useChatStream 的流式请求逻辑，建议将流式请求部分提取为独立函数
    // 临时方案：window.dispatchEvent 触发自定义事件，由 useChatStream 监听并处理
    window.dispatchEvent(new CustomEvent("resend-message", {
      detail: {
        sessionId: targetSessionId,
        messages: [
          ...current.messages.slice(0, msgIdx + 1),
        ],
        userMsg,
        model,
      },
    }))
  }

  // 编辑单条消息内容
  const handleEditMessage = (messageId: number, newContent: string) => {
    if (!current) return
    setSessions((prevSessions) => {
      let needResend = false
      const targetSessionId = current.id
      let userMsg: Message | null = null
      let msgIdx = -1
      const newSessions = prevSessions.map((s) => {
        if (s.id !== current.id) return s
        const newMessages = s.messages.map((m, idx) => {
          if (m.id === messageId) {
            if (m.content !== newContent) {
              needResend = true
              userMsg = { ...m, content: newContent }
              msgIdx = idx
              return userMsg
            }
          }
          return m
        })
        return { ...s, messages: newMessages }
      })
      // 只有内容变更时才重发
      if (needResend && userMsg && msgIdx !== -1) {
        // 删除该用户消息之后的所有消息（含 AI 回复），并插入 assistant 空消息
        const updatedSessions = newSessions.map((s) => {
          if (s.id !== targetSessionId) return s
          return {
            ...s,
            messages: [
              ...s.messages.slice(0, msgIdx + 1),
              { role: "assistant", content: "", id: Date.now() + Math.floor(Math.random() * 10000) },
            ],
          }
        })
        // 只做数据变更，不派发副作用
        // 通过 setPendingResend 交由 useEffect 处理副作用
        setPendingResend({
          sessionId: targetSessionId,
          messages: [
            ...newSessions.find((s) => s.id === targetSessionId)!.messages.slice(0, msgIdx + 1),
          ],
          userMsg,
          model,
        })
        return updatedSessions
      }
      return newSessions
    })
  }

  // 新增：监听 pendingResend，派发 resend-message 事件
  useEffect(() => {
    if (pendingResend) {
      window.dispatchEvent(new CustomEvent("resend-message", {
        detail: pendingResend,
      }))
      setPendingResend(null)
    }
  }, [pendingResend])

  // 当前会话
  const current = sessions.find((s) => s.id === activeSessionId)
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-100 via-white to-blue-200">
      {/* 顶部导航栏 */}
      <header className="w-full flex items-center justify-between px-8 py-4 border-b border-blue-200 bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <span className="text-3xl font-extrabold tracking-tight text-blue-600 drop-shadow">
            Nebula
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
            onResendMessage={handleResendMessage}
            onEditMessage={handleEditMessage}
          />
          {/* 输入栏 */}
          <ChatInput
            input={input}
            setInput={setInput}
            onSend={handleSend}
            activeSessionId={activeSessionId}
          />
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
