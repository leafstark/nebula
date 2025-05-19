import { useRef, useEffect } from "react"

interface Message {
  role: string
  content: string
}

interface Props {
  messages: Message[]
  activeSessionId: number // 新增 activeSessionId prop
}

export default function ChatWindow({ messages, activeSessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null)
  const prevActiveSessionIdRef = useRef<number | null>(null)
  const isInitialMountRef = useRef(true) // 用于处理首次加载

  // 找到最后一条用户消息的索引
  const lastUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i
    }
    return -1
  })()

  // 滚动逻辑
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current
      let scrollBehavior: "auto" | "smooth" = "auto"

      if (isInitialMountRef.current) {
        // 首次挂载，瞬时滚动
        scrollBehavior = "auto"
        isInitialMountRef.current = false
      } else if (prevActiveSessionIdRef.current !== activeSessionId) {
        // activeSessionId 变化，说明切换了会话，瞬时滚动
        scrollBehavior = "auto"
      } else {
        // activeSessionId 未变，说明是当前会话有新消息，平滑滚动
        scrollBehavior = "smooth"
      }
      prevActiveSessionIdRef.current = activeSessionId

      if (lastUserMsgRef.current) {
        const target = lastUserMsgRef.current
        container.scrollTo({
          top: target.offsetTop - 20,
          behavior: scrollBehavior,
        })
      } else if (messages.length > 0) {
        // 如果没有用户消息，但有其他消息，则滚动到容器最底部
        if (scrollBehavior === "smooth") {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          })
        } else {
          container.scrollTop = container.scrollHeight // 瞬时滚动
        }
      }
    }
  }, [messages, lastUserIdx, activeSessionId]) // 依赖项增加 activeSessionId

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto px-12 pt-8 pb-40"
    >
      <div className="flex flex-col gap-12 max-w-200 mx-auto">
        {messages.length > 0 ? (
          messages.map((msg, idx) => (
            <div // ref 作用于此 div
              key={idx}
              ref={idx === lastUserIdx ? lastUserMsgRef : undefined}
            >
              <div
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
                  {msg.role === "assistant" && !msg.content ? (
                    <span className="animate-pulse">正在思考</span>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-blue-300 dark:text-blue-800 text-lg text-center mt-32 select-none">
            开始新的对话吧！
          </div>
        )}
        {/* 在所有消息后添加一个占位符，以确保有足够的滚动空间 */}
        {messages.length > 0 && (
          <div style={{ height: "70vh" }} aria-hidden="true" />
        )}
      </div>
    </div>
  )
}
