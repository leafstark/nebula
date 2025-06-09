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
    const res = await fetch("api/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model,
        stream: true,
        messages: messagesForApi,
      }),
    })
    if (res.status !== 200) {
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

// 自动摘要函数，失败时重试最多3次
async function summarizeMessages(
  messages: Array<{ role: string; content: string }>,
  model: string,
  retry = 0
): Promise<string> {
  const summaryPrompt = [
    ...messages,
    {
      role: "user",
      content: `请将以上对话内容提炼为结构化摘要，包括：

## 事件要点
简要描述发生了什么事件。

## 人物情绪
各个角色情绪状态的变化（如生气、疑惑、信任等）。

## 关系进展
角色之间的关系是否有所进展或恶化？

## 重要伏笔
如果有台词暗示、行为转变，请单独记录。

请保持格式清晰，避免冗余。内容请使用第三人称。`,
    },
  ]
  try {
    const res = await fetch("api/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model,
        stream: false,
        messages: summaryPrompt,
      }),
    })
    if (res.status !== 200) throw new Error("摘要请求失败")
    const data = await res.json()
    return data.choices?.[0]?.message?.content || "[摘要失败]"
  } catch {
    if (retry < 2) {
      // 最多重试3次
      return summarizeMessages(messages, model, retry + 1)
    }
    return "[摘要失败]"
  }
}

// 拼接摘要和未被摘要覆盖的对话轮次，始终保证最近5轮原文，其余用摘要
function getMessagesWithSummary(
  summaries: Array<{ round: number; content: string }>,
  messages: Array<{ role: string; content: string; id?: number }>
) {
  // 拆分为每5轮一组
  const uaMessages = messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  )
  const rounds = []
  for (let i = 0; i < uaMessages.length; i += 2) {
    rounds.push(uaMessages.slice(i, i + 2))
  }
  const keepRounds = 5
  const totalRounds = rounds.length
  // 计算需要保留的原文起始位置
  const remainStart = Math.max(totalRounds - keepRounds, 0)
  // 需要拼接的摘要（每5轮一条，且只拼接完全覆盖的摘要）
  let covered = 0
  const mergedSummaries: string[] = []
  let lastRound = 0
  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i]
    // 只拼接覆盖不到 remainStart 的摘要
    if (s.round <= remainStart && s.round > covered) {
      const startRound = lastRound + 1
      const endRound = s.round
      mergedSummaries.push(`【摘要${i + 1}：第${startRound}-${endRound}轮】\n${s.content}`)
      covered = s.round
      lastRound = s.round
    }
  }
  // 合并所有摘要为一个 system message
  const summaryMessages =
    mergedSummaries.length > 0
      ? [
          {
            role: "system",
            content: `以下是之前多轮对话的摘要：\n${mergedSummaries.join("\n\n")}`,
          }
        ]
      : []
  // 摘要未覆盖到的原文部分（即 covered~remainStart-1 这些原文）
  const originalRounds = rounds.slice(covered, remainStart).flat()
  // 保留最近5轮原文
  const remainRounds = rounds.slice(remainStart).flat()
  return [...summaryMessages, ...originalRounds, ...remainRounds]
}

// 辅助函数：在assistant回复完毕后判断是否需要摘要
const triggerSummarization = async (
  sessionId: number,
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>,
  model: string
) => {
  let latestSessions: Session[] = []
  setSessions((prev) => {
    latestSessions = prev as Session[]
    return prev
  })
  await new Promise((r) => setTimeout(r, 0))
  const session = latestSessions.find((s) => s.id === sessionId)
  if (!session) return
  const summaries = session.summaries || []
  const uaMessages = session.messages.filter(
    (m) => m.role === "user" || m.role === "assistant"
  )
  const rounds: { role: string; content: string; id?: number }[][] = []
  for (let i = 0; i < uaMessages.length; i += 2) {
    rounds.push(uaMessages.slice(i, i + 2))
  }
  const SUMMARY_ROUND = 5
  let summarizedRounds = 0
  if (summaries.length > 0) {
    summarizedRounds = summaries[summaries.length - 1].round
  }
  // 只要有新的 SUMMARY_ROUND 组就提前生成摘要
  while (rounds.length >= summarizedRounds + SUMMARY_ROUND) {
    const toSummarize = rounds
      .slice(summarizedRounds, summarizedRounds + SUMMARY_ROUND)
      .flat()
    const summary = await summarizeMessages(
      toSummarize.map(({ role, content }) => ({ role, content })),
      model
    )
    if (summary !== "[摘要失败]") {
      const newSummaries = [
        ...summaries,
        { round: summarizedRounds + SUMMARY_ROUND, content: summary },
      ]
      setSessions((prevSessions) =>
        (prevSessions as Session[]).map((s) =>
          s.id === sessionId ? { ...s, summaries: newSummaries } : s
        )
      )
      // 更新 summaries 变量，防止多摘要
      summaries.push({
        round: summarizedRounds + SUMMARY_ROUND,
        content: summary,
      })
    }
    summarizedRounds += SUMMARY_ROUND
  }
}

export function useChatStream({
  sessions,
  setSessions,
  activeSessionId,
  setActiveSessionId,
  model,
  useSummary = true,
}: {
  sessions: Session[]
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  activeSessionId: number | null
  setActiveSessionId: (id: number | null) => void
  model: string
  useSummary?: boolean
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
      const summaries = currentSession.summaries || []
      const allMessages = [
        ...currentSession.messages,
        { role: "user", content: userInput, id: genMsgId() },
      ]
      if (useSummary) {
        messagesForApi = getMessagesWithSummary(summaries, allMessages)
        // 确保最后一条消息是用户输入
        if (
          messagesForApi.length === 0 ||
          messagesForApi[messagesForApi.length - 1].content !== userInput
        ) {
          messagesForApi.push({
            role: "user",
            content: userInput,
            id: genMsgId(),
          })
        }
      } else {
        messagesForApi = allMessages
      }
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
    // 先流式请求，再摘要
    await streamChatCompletion({
      targetSessionId,
      messagesForApi,
      model,
      setSessions,
    })
    if (useSummary) {
      await triggerSummarization(targetSessionId, setSessions, model)
    }
  }

  useEffect(() => {
    // 监听重发消息事件
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      const { sessionId, messages, model: eventModel } = detail
      // 查找当前 session 的 summaries
      const currentSession = sessions.find((s) => s.id === sessionId)
      let messagesForApi: Array<{
        role: string
        content: string
        id?: number
      }> = []
      if (currentSession) {
        const summaries = currentSession.summaries || []
        messagesForApi = useSummary
          ? getMessagesWithSummary(
              summaries,
              messages as Array<{ role: string; content: string; id?: number }>
            )
          : (messages as Array<{ role: string; content: string; id?: number }>)
      } else {
        messagesForApi = messages
      }
      await streamChatCompletion({
        targetSessionId: sessionId,
        messagesForApi,
        model: eventModel,
        setSessions,
      })
      if (useSummary) {
        await triggerSummarization(sessionId, setSessions, model)
      }
    }
    window.addEventListener("resend-message", handler)
    return () => window.removeEventListener("resend-message", handler)
  }, [setSessions, model, sessions, useSummary])

  return { input, setInput, handleSend }
}
