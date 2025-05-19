import { useState, useEffect } from "react"
import { Button, Select, Input, Divider, Dropdown, Popconfirm } from "antd"
import { DeleteOutlined, PlusOutlined, MoreOutlined, EditFilled } from "@ant-design/icons"
import "antd/dist/reset.css"

const MODEL_LIST = [
  "gpt-4o",
  "gpt-4.1",
  "claude-3.5-sonnet",
  "claude-3.7-sonnet",
  "claude-3.7-sonnet-thought",
  "gemini-2.5-pro",
]

function App() {
  const [sessions, setSessions] = useState([
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
      if (e.name === "QuotaExceededError") {
        alert("存储空间已满，请删除部分历史会话后重试。")
        // 或自动清理最旧的会话后重试
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
        <aside className="w-72 max-h-screen overflow-y-auto bg-white/90 dark:bg-gray-950/90 border-r border-blue-100 dark:border-blue-900 p-6 flex flex-col shadow-md">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            className="w-full"
            onClick={handleNewSession}
          >
            新建会话
          </Button>
          <Divider />
          <div className="flex-1 overflow-y-auto">
            {sessions.length === 0 ? (
              <div className="text-blue-300 dark:text-blue-800 text-sm text-center mt-16">
                暂无会话
              </div>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => {
                  const menuItems = [
                    {
                      key: "rename",
                      icon: <EditFilled />,
                      label: (
                        <span onClick={() => handleRenameSession(s.id, s.name)}>重命名</span>
                      ),
                    },
                    {
                      key: "delete",
                      icon: <DeleteOutlined />,
                      label: (
                        <Popconfirm
                          title="确定要删除该会话吗？"
                          okText="删除"
                          cancelText="取消"
                          onConfirm={() => handleDeleteSession(s.id)}
                        >
                          删除
                        </Popconfirm>
                      ),
                    },
                  ]
                  return (
                    <li key={s.id} className="flex items-center group relative">
                      <Button
                        type={s.id === activeSessionId ? "primary" : "default"}
                        className={`flex-1 text-left px-3 py-2 rounded-lg font-medium truncate ${
                          s.id === activeSessionId
                            ? "!bg-blue-100 !text-blue-700 dark:!bg-blue-900 dark:!text-blue-200 shadow"
                            : "hover:!bg-blue-50 dark:hover:!bg-blue-800 !text-gray-700 dark:!text-gray-200"
                        }`}
                        onClick={() => handleSelectSession(s.id)}
                        style={{
                          boxShadow: "none",
                          border: "none",
                          background: "none",
                        }}
                      >
                        {s.name}
                      </Button>
                      <Dropdown
                        trigger={["click"]}
                        menu={{ items: menuItems }}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          className={`right-2 absolute text-lg transition ${
                            s.id === activeSessionId
                              ? "flex"
                              : "hidden group-hover:flex"
                          }`}
                          title="更多操作"
                        />
                      </Dropdown>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </aside>
        {/* 聊天主窗口 */}
        <section className="flex-1 flex flex-col justify-end bg-transparent relative min-h-0 h-[calc(100vh-70px)]">
          <div className="flex-1 min-h-0 overflow-y-auto px-12 pt-8 pb-40 flex flex-col gap-12">
            {current && current.messages.length > 0 ? (
              current.messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  } group relative`}
                >
                  <div
                    className={`px-4 py-2 rounded-2xl shadow text-base whitespace-pre-line break-words relative ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-br-md"
                        : "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-bl-md"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-blue-300 dark:text-blue-800 text-lg text-center mt-32 select-none">
                开始新的对话吧！
              </div>
            )}
          </div>
          {/* 输入栏 */}
          <form
            className="absolute left-1/2 bottom-8 -translate-x-1/2 z-30 flex items-end gap-3 bg-white/80 dark:bg-gray-950/80 border border-blue-100 dark:border-blue-900 rounded-xl shadow-xl px-6 py-4 backdrop-blur-md"
            style={{ width: "min(720px,90vw)" }}
            onSubmit={handleSend}
          >
            <Input.TextArea
              className="flex-1 resize-none rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-gray-800 p-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[48px] max-h-40 shadow-inner transition"
              placeholder="输入你的问题..."
              autoSize={{ minRows: 1, maxRows: 6 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              // 兼容中文输入法，isComposing 实际存在于 KeyboardEvent 的 nativeEvent 上
              onPressEnter={(e) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (!e.shiftKey && !(e.nativeEvent as any).isComposing) {
                  e.preventDefault()
                  if (input.trim()) handleSend(e)
                }
              }}
            />
            <Button
              type="primary"
              htmlType="submit"
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold shadow hover:from-blue-600 hover:to-blue-800 transition"
              disabled={!input.trim()}
            >
              发送
            </Button>
          </form>
        </section>
      </main>
      {/* 会话重命名弹窗 */}
      {renameModalVisible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl p-8 min-w-[320px] flex flex-col gap-4">
            <div className="text-lg font-bold mb-2">重命名会话</div>
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onPressEnter={handleRenameOk}
              maxLength={30}
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-2">
              <Button onClick={handleRenameCancel}>取消</Button>
              <Button type="primary" onClick={handleRenameOk} disabled={!renameValue.trim()}>
                确定
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
