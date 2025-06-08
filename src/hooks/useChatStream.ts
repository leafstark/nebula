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
    const SUMMARY_ROUND = 5 // 每5轮摘要

    // 自动摘要函数
    async function summarizeMessages(messages: Array<{ role: string; content: string }>): Promise<string> {
      const summaryPrompt = [
        { role: "system", content: "请总结以下多轮对话内容，保留关键信息，简明扼要。" },
        ...messages
      ]
      const res = await fetch("api/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({
          model,
          stream: false,
          messages: summaryPrompt,
        }),
      })
      if (res.status !== 200) return "[摘要失败]"
      const data = await res.json()
      return data.choices?.[0]?.message?.content || "[摘要失败]"
    }

    if (activeSessionId === null) {
      const newId = Date.now()
      const newSessionName = userInput.substring(0, 30) || `新会话`
      const newSession: Session = {
        id: newId,
        name: newSessionName,
        messages: [{ role: "user", content: userInput, id: genMsgId() }],
        summaries: [],
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
      if (!currentSession) return
      // 1. 计算已摘要到第几轮
      const summaries = currentSession.summaries || []
      let summarizedRounds = 0
      if (summaries.length > 0) {
        summarizedRounds = summaries[summaries.length - 1].round
      }
      // 2. 取出未被摘要的消息（从 summarizedRounds*2 开始，因为一轮2条消息）
      const allMessages = [
        ...currentSession.messages,
        { role: "user", content: userInput, id: genMsgId() },
      ]
      // 只统计 user/assistant 消消息
      const uaMessages = allMessages.filter(m => m.role === "user" || m.role === "assistant")
      // 以2条为一轮分组
      const rounds: { role: string; content: string; id?: number }[][] = []
      for (let i = 0; i < uaMessages.length; i += 2) {
        rounds.push(uaMessages.slice(i, i + 2))
      }
      // 3. 判断未摘要的轮数
      const unSummarizedRounds = rounds.slice(summarizedRounds)
      // 4. 如果未摘要轮数 >= SUMMARY_ROUND，则摘要前 SUMMARY_ROUND 轮
      const newSummaries = [...summaries]
      let remainRounds = unSummarizedRounds
      if (unSummarizedRounds.length >= SUMMARY_ROUND) {
        const toSummarize = unSummarizedRounds.slice(0, SUMMARY_ROUND).flat()
        const summary = await summarizeMessages(toSummarize.map(({ role, content }) => ({ role, content })))
        newSummaries.push({ round: summarizedRounds + SUMMARY_ROUND, content: summary })
        // 剩余未摘要的轮
        remainRounds = unSummarizedRounds.slice(SUMMARY_ROUND)
        // 更新Session.summaries
        setSessions((prevSessions) => prevSessions.map(s =>
          s.id === targetSessionId ? { ...s, summaries: newSummaries } : s
        ))
      }
      // 5. 组装 messagesForApi: 所有 summaries + remainRounds + 当前user消息（如果未被包含）
      messagesForApi = [
        ...newSummaries.map(s => ({ role: "system", content: `历史摘要：${s.content}` })),
        ...remainRounds.flat(),
      ]
      // 如果最后一条不是当前userInput，则补上
      if (
        messagesForApi.length === 0 ||
        messagesForApi[messagesForApi.length - 1].content !== userInput
      ) {
        messagesForApi.push({ role: "user", content: userInput, id: genMsgId() })
      }
      // 更新messages
      setSessions((prevSessions) =>
        prevSessions.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [
                  ...allMessages,
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
