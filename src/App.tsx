import { useState } from "react"
import { Select } from "antd"
import "antd/dist/reset.css"
import SessionList from "./components/SessionList"
import ChatWindow from "./components/ChatWindow"
import ChatInput from "./components/ChatInput"
import RenameModal from "./components/RenameModal"
import { useSessions } from "./hooks/useSessions"
import { useModel } from "./hooks/useModel"
import { useChatStream } from "./hooks/useChatStream"

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
