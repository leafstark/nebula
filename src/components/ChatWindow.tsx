import { Spin } from "antd"
import { useRef, useEffect } from "react"

interface Message {
  role: string
  content: string
}

interface Props {
  messages: Message[]
  activeSessionId: number | null
}

export default function ChatWindow({ messages, activeSessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastUserMsgRef = useRef<HTMLDivElement>(null) // 保留，虽然当前滚动逻辑不直接用它定位
  const prevActiveSessionIdRef = useRef<number | null>(null)
  const isInitialMountRef = useRef(true)
  // 用于存储上一次渲染时 messages 数组的长度
  const prevMessagesLengthRef = useRef(messages.length)

  const userHasManuallyScrolledRef = useRef(false)
  // isAutoScrollingRef 现在表示一个由程序发起的滚动是否正在进行中
  const isAutoScrollingRef = useRef(false)

  const lastUserIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return i
    }
    return -1
  })()

  // 监听滚动相关事件
  useEffect(() => {
    const scrollContainer = containerRef.current
    if (!scrollContainer) return

    const handleUserScrollInitiation = () => {
      // 如果用户通过滚轮或触摸开始滚动，则认为中断了任何进行中的自动滚动
      if (isAutoScrollingRef.current) {
        isAutoScrollingRef.current = false
      }
      // userHasManuallyScrolledRef 的更新将由 'scroll' 事件处理
    }

    const handleScroll = () => {
      if (!containerRef.current) return

      // 如果是程序触发的滚动正在进行中，则不处理用户手动滚动逻辑
      if (isAutoScrollingRef.current) {
        return
      }

      // 否则，这是用户滚动或已结束的程序滚动的后续事件
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current
      const threshold = 10 // 滚动到底部的容差

      if (scrollTop + clientHeight < scrollHeight - threshold) {
        userHasManuallyScrolledRef.current = true
      } else {
        userHasManuallyScrolledRef.current = false
      }
    }

    const handleScrollEnd = () => {
      // 当任何滚动（程序或用户）结束时触发
      // 如果是程序触发的滚动刚刚自然结束（未被用户中断）
      if (isAutoScrollingRef.current) {
        isAutoScrollingRef.current = false
        // 如果程序滚动结束后位于底部，确保用户手动滚动状态被重置
        if (containerRef.current) {
          const { scrollTop, scrollHeight, clientHeight } = containerRef.current
          if (scrollTop + clientHeight >= scrollHeight - 1) {
            // 更小的容差判断是否在底部
            userHasManuallyScrolledRef.current = false
          }
        }
      }
      // 如果是用户滚动结束，userHasManuallyScrolledRef 已由 handleScroll 更新
    }

    // 添加事件监听器
    scrollContainer.addEventListener("wheel", handleUserScrollInitiation, {
      passive: true,
    })
    scrollContainer.addEventListener("touchstart", handleUserScrollInitiation, {
      passive: true,
    })
    scrollContainer.addEventListener("scroll", handleScroll, { passive: true })
    scrollContainer.addEventListener("scrollend", handleScrollEnd)

    return () => {
      // 移除事件监听器
      scrollContainer.removeEventListener("wheel", handleUserScrollInitiation)
      scrollContainer.removeEventListener(
        "touchstart",
        handleUserScrollInitiation
      )
      scrollContainer.removeEventListener("scroll", handleScroll)
      scrollContainer.removeEventListener("scrollend", handleScrollEnd)
    }
  }, []) // 空依赖数组，仅在挂载和卸载时运行

  // 滚动逻辑
  useEffect(() => {
    const currentMessagesLength = messages.length

    if (containerRef.current) {
      const container = containerRef.current
      let scrollBehavior: "auto" | "smooth" = "smooth"
      let forceScroll = false

      if (isInitialMountRef.current) {
        scrollBehavior = "auto"
        isInitialMountRef.current = false
        userHasManuallyScrolledRef.current = false
        forceScroll = true
      } else if (prevActiveSessionIdRef.current !== activeSessionId) {
        scrollBehavior = "auto"
        userHasManuallyScrolledRef.current = false
        forceScroll = true
      } else if (currentMessagesLength > prevMessagesLengthRef.current) {
        // 新的消息项被添加到数组中 (例如用户发送了消息，或AI开始了新的回复)
        // 此时应该滚动到新消息，因此重置手动滚动状态
        userHasManuallyScrolledRef.current = false
        // 对于活跃会话中的新消息，通常使用平滑滚动
      }

      if (!forceScroll && userHasManuallyScrolledRef.current) {
        prevActiveSessionIdRef.current = activeSessionId
        prevMessagesLengthRef.current = currentMessagesLength
        return
      }

      // 标记即将进行自动滚动
      // isAutoScrollingRef 会在 scrollend 或用户主动滚动时重置为 false
      isAutoScrollingRef.current = true
      container.scrollTo({
        top: container.scrollHeight,
        behavior: scrollBehavior,
      })

      prevActiveSessionIdRef.current = activeSessionId
    }

    // 更新上一次的 messages 长度，为下一次 effect 执行做准备
    prevMessagesLengthRef.current = currentMessagesLength
  }, [messages, activeSessionId])

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 overflow-y-auto px-12 pt-8 pb-40"
    >
      <div className="flex flex-col gap-12 max-w-200 mx-auto">
        {messages.length > 0
          ? messages.map((msg, idx) => (
              <div
                key={idx}
                ref={idx === lastUserIdx ? lastUserMsgRef : undefined}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group relative`}
              >
                <div
                  className={`px-4 py-2 rounded-2xl shadow-2xl text-base whitespace-pre-line break-words relative transition-colors backdrop-bl-lg
                    ${msg.role === "user"
                      ? "bg-blue-100/80 text-blue-900 rounded-br-md border border-blue-200/60 ring-1 ring-blue-300/20"
                      : "bg-white/80 text-blue-900 rounded-bl-md border border-gray-200/60 ring-1 ring-blue-400/10"}
                  `}
                  style={{
                    boxShadow:
                      "0 8px 40px 0 rgba(0,0,0,0.16), 0 2px 8px 0 rgba(0,0,0,0.10)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {msg.role === "assistant" && !msg.content ? (
                    <div className="flex items-center gap-2">
                      <Spin size="small" />
                      <span className="animate-pulse">正在思考</span>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))
          : null}
      </div>
    </div>
  )
}
