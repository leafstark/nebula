import { useState, useEffect } from "react"
import type { Session } from "../components/SessionList"

// 抽取流式请求和消息处理的核心逻辑
async function streamChatCompletion({
  targetSessionId,
  messagesForApi,
  model,
  setSessions,
}: {
  targetSessionId: number
  messagesForApi: Array<{ role: string; content: string; id?: number }>
  model: string
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
}) {
  try {
    const res = await fetch(
      "api/v1/chat/completions",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          stream: true,
          messages: messagesForApi,
        }),
      }
    )
    if(res.status !== 200) {
      const errorText = await res.text()
      console.error("API 错误:", errorText)
      setSessions((prevSessions) =>
        prevSessions.map((s) => {
          if (s.id !== targetSessionId) return s
          const msgs = [...s.messages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg?.role === "assistant") {
            msgs[msgs.length - 1] = {
              ...lastMsg,
              content: "[API 错误]",
            }
            return { ...s, messages: msgs }
          }
          return s
        })
      )
      return
    }
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
        const lines = partialChunk.split("\n")
        partialChunk = lines.pop() || ""
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.substring(5).trim()
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
        setSessions((prevSessions) =>
          prevSessions.map((s) => {
            if (s.id !== targetSessionId) return s
            const msgs = [...s.messages]
            const lastMsg = msgs[msgs.length - 1]
            if (lastMsg?.role === "assistant") {
              msgs[msgs.length - 1] = {
                ...lastMsg,
                content: accumulatedResponse,
              }
              return { ...s, messages: msgs }
            }
            return s
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

export function useChatStream({
  sessions,
  setSessions,
  activeSessionId,
  setActiveSessionId,
  model,
}: {
  sessions: Session[]
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  activeSessionId: number | null
  setActiveSessionId: (id: number | null) => void
  model: string
}) {
  const [input, setInput] = useState("")

  // 发送消息（流式回复）
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const userInput = input.trim()
    if (!userInput) return
    setInput("")
    let targetSessionId: number
    let messagesForApi: Array<{ role: string; content: string; id?: number }>
    const genMsgId = () => Date.now() + Math.floor(Math.random() * 10000)
    if (activeSessionId === null) {
      const newId = Date.now()
      const newSessionName = userInput.substring(0, 30) || `新会话`
      const newSession: Session = {
        id: newId,
        name: newSessionName,
        messages: [{ role: "user", content: userInput, id: genMsgId() }],
      }
      setSessions((prevSessions) => [
        {
          ...newSession,
          messages: [
            ...newSession.messages,
            { role: "assistant", content: "", id: genMsgId() },
          ],
        },
        ...prevSessions,
      ])
      setActiveSessionId(newId)
      targetSessionId = newId
      messagesForApi = newSession.messages
    } else {
      targetSessionId = activeSessionId
      const currentSession = sessions.find((s) => s.id === activeSessionId)
      messagesForApi = currentSession
        ? [
            ...currentSession.messages,
            { role: "user", content: userInput, id: genMsgId() },
          ]
        : [{ role: "user", content: userInput, id: genMsgId() }]
      setSessions((prevSessions) =>
        prevSessions.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [
                  ...messagesForApi,
                  { role: "assistant", content: "", id: genMsgId() },
                ],
              }
            : s
        )
      )
    }
    // 调用抽取的流式处理逻辑
    streamChatCompletion({
      targetSessionId,
      messagesForApi,
      model,
      setSessions,
    })
  }

  useEffect(() => {
    // 监听重发消息事件
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      const { sessionId, messages, model: eventModel } = detail
      // 直接复用流式请求逻辑
      streamChatCompletion({
        targetSessionId: sessionId,
        messagesForApi: messages,
        model: eventModel,
        setSessions,
      })
    }
    window.addEventListener("resend-message", handler)
    return () => window.removeEventListener("resend-message", handler)
  }, [setSessions])

  return { input, setInput, handleSend }
}
