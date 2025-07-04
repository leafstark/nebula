import { useState, useEffect, useRef, useCallback } from "react"
import type { Session } from "../components/SessionList"

async function streamChatCompletion({
  targetSessionId,
  messagesForApi,
  model,
  setSessions,
  onStreamStart,
  onStreamEnd,
  abortSignal,
  openaiApiKey,
  openaiBaseUrl,
}: {
  targetSessionId: number
  messagesForApi: Array<{ role: string; content: string; id?: number }>
  model: string
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  onStreamStart?: () => void
  onStreamEnd?: () => void
  abortSignal?: AbortSignal
  openaiApiKey?: string
  openaiBaseUrl?: string
}) {
  try {
    onStreamStart?.()
    const res = await fetch("api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openaiApiKey ? { "X-OPENAI-API-KEY": openaiApiKey } : {}),
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: messagesForApi,
        openaiBaseUrl,
      }),
      signal: abortSignal,
    })
    if (res.status !== 200) {
      const errorText = await res.text()
      console.error("API 错误:", errorText)
      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
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
        // 置顶有交互的 session
        const idx = updated.findIndex((s) => s.id === targetSessionId)
        if (idx > 0) {
          const [session] = updated.splice(idx, 1)
          updated.unshift(session)
        }
        return updated
      })
      onStreamEnd?.()
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
        setSessions((prevSessions) => {
          const updated = prevSessions.map((s) => {
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
          // 置顶有交互的 session
          const idx = updated.findIndex((s) => s.id === targetSessionId)
          if (idx > 0) {
            const [session] = updated.splice(idx, 1)
            updated.unshift(session)
          }
          return updated
        })
      }
    }
    onStreamEnd?.()
  } catch (error) {
    if (
      typeof error === "object" &&
      error &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError"
    ) {
      // 终止时，在消息末尾追加一个标记
      setSessions((prevSessions) => {
        return prevSessions.map((s) => {
          if (s.id !== targetSessionId) return s
          const msgs = [...s.messages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg?.role === "assistant") {
            // 如果已经有内容，则在后面追加，否则直接设置为标记
            const newContent = lastMsg.content
              ? `${lastMsg.content} [手动中断]`
              : "[手动中断]"
            msgs[msgs.length - 1] = {
              ...lastMsg,
              content: newContent,
            }
            return { ...s, messages: msgs }
          }
          return s
        })
      })
    } else {
      console.error("API 调用失败:", error)
      setSessions((prevSessions) => {
        const updated = prevSessions.map((s) => {
          if (s.id !== targetSessionId) return s
          const msgs = [...s.messages]
          const lastMsg = msgs[msgs.length - 1]
          if (lastMsg?.role === "assistant") {
            msgs[msgs.length - 1] = { ...lastMsg, content: "[网络错误]" }
            return { ...s, messages: msgs }
          }
          return s
        })
        // 置顶有交互的 session
        const idx = updated.findIndex((s) => s.id === targetSessionId)
        if (idx > 0) {
          const [session] = updated.splice(idx, 1)
          updated.unshift(session)
        }
        return updated
      })
    }
    onStreamEnd?.()
  }
}

// 自动摘要函数，失败时重试最多3次
async function summarizeMessages(
  messages: Array<{ role: string; content: string }>,
  model: string,
  openaiBaseUrl?: string,
  openaiApiKey?: string,
  retry = 0
): Promise<string> {
  const summaryPrompt = [
    ...messages,
    {
      role: "user",
      content: `请将以上对话内容提炼为一份摘要，包含以下部分：

### 核心议题
对话围绕的主要问题或话题是什么。

### 关键信息
对话中提到的最重要信息、数据或观点。

### 结论或下一步
对话达成了什么共识、结论，或者下一步计划是什么。

请使用第三人称，保持客观、简洁。`,
    },
  ]
  try {
    const res = await fetch("api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(openaiApiKey ? { "X-OPENAI-API-KEY": openaiApiKey } : {}),
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: summaryPrompt,
        openaiBaseUrl,
      }),
    })
    if (res.status !== 200) throw new Error("摘要请求失败")
    const data = await res.json()
    return data.choices?.[0]?.message?.content || "[摘要失败]"
  } catch {
    if (retry < 2) {
      // 最多重试3次
      return summarizeMessages(
        messages,
        model,
        openaiBaseUrl,
        openaiApiKey,
        retry + 1
      )
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
      mergedSummaries.push(
        `【摘要${i + 1}：第${startRound}-${endRound}轮】\n${s.content}`
      )
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
            content: `以下是之前多轮对话的摘要：\n${mergedSummaries.join(
              "\n\n"
            )}`,
          },
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
  model: string,
  openaiBaseUrl?: string,
  openaiApiKey?: string
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
    console.log("已摘要的轮次：", summarizedRounds)
  }
  // 只要有新的 SUMMARY_ROUND 组就提前生成摘要
  while (rounds.length >= summarizedRounds + SUMMARY_ROUND) {
    const toSummarize = rounds
      .slice(summarizedRounds, summarizedRounds + SUMMARY_ROUND)
      .flat()
    const summary = await summarizeMessages(
      toSummarize.map(({ role, content }) => ({ role, content })),
      model,
      openaiBaseUrl,
      openaiApiKey
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
  openaiApiKey,
  openaiBaseUrl,
  systemPrompt,
}: {
  sessions: Session[]
  setSessions: React.Dispatch<React.SetStateAction<Session[]>>
  activeSessionId: number | null
  setActiveSessionId: (id: number | null) => void
  model: string
  useSummary?: boolean
  openaiApiKey?: string
  openaiBaseUrl?: string
  systemPrompt?: string
}) {
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 提取核心流式聊天逻辑
  const startChatStreaming = useCallback(
    async (
      targetSessionId: number,
      messages: Array<{ role: string; content: string; id?: number }>,
      streamModel: string
    ) => {
      let messagesForApi = [...messages]

      if (useSummary) {
        const currentSession = sessions.find((s) => s.id === targetSessionId)
        if (currentSession) {
          messagesForApi = getMessagesWithSummary(
            currentSession.summaries || [],
            messages
          )
        }
      }

      // 确保 systemPrompt 被正确处理
      if (systemPrompt && systemPrompt.trim()) {
        const systemMsgIndex = messagesForApi.findIndex(
          (m) => m.role === "system"
        )
        if (systemMsgIndex !== -1) {
          const originalSystemContent = messagesForApi[systemMsgIndex].content
          messagesForApi[systemMsgIndex] = {
            ...messagesForApi[systemMsgIndex],
            content: `${systemPrompt}\n\n${originalSystemContent}`,
          }
        } else {
          // 否则，在开头插入新的 system message
          messagesForApi.unshift({ role: "system", content: systemPrompt })
        }
      }

      const abortController = new AbortController()
      abortControllerRef.current = abortController

      await streamChatCompletion({
        targetSessionId,
        messagesForApi,
        model: streamModel,
        setSessions: (updater) => {
          // 置顶有交互的 session
          setSessions((prevSessions) => {
            const updated =
              typeof updater === "function" ? updater(prevSessions) : updater
            const idx = updated.findIndex((s) => s.id === targetSessionId)
            if (idx > 0) {
              const [session] = updated.splice(idx, 1)
              updated.unshift(session)
            }
            return updated
          })
        },
        onStreamStart: () => setIsStreaming(true),
        onStreamEnd: () => setIsStreaming(false),
        abortSignal: abortController.signal,
        openaiApiKey,
        openaiBaseUrl,
      })

      abortControllerRef.current = null

      if (useSummary) {
        await triggerSummarization(
          targetSessionId,
          setSessions,
          model, // 摘要模型使用外部的
          openaiBaseUrl,
          openaiApiKey
        )
      }
    },
    [
      sessions,
      useSummary,
      systemPrompt,
      setSessions,
      model,
      openaiApiKey,
      openaiBaseUrl,
    ]
  )

  // 发送消息（流式回复）
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isStreaming) return
    const userInput = input.trim()
    if (!userInput) return
    setInput("")
    let targetSessionId: number
    const genMsgId = () => Date.now() + Math.floor(Math.random() * 10000)
    let allMessages: Array<{ role: string; content: string; id?: number }>

    if (activeSessionId === null) {
      const newId = Date.now()
      const newSessionName = userInput.substring(0, 30) || `新会话`
      const newSession: Session = {
        id: newId,
        name: newSessionName,
        messages: [{ role: "user", content: userInput, id: genMsgId() }],
        summaries: [],
        systemPrompt,
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
      allMessages = [...newSession.messages]
    } else {
      targetSessionId = activeSessionId
      const currentSession = sessions.find((s) => s.id === activeSessionId)
      if (!currentSession) return
      allMessages = [
        ...currentSession.messages,
        { role: "user", content: userInput, id: genMsgId() },
      ]
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
    await startChatStreaming(targetSessionId, allMessages, model)
  }

  const stopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  useEffect(() => {
    // 监听重发消息事件
    const handler = async (e: Event) => {
      if (isStreaming) return
      const {
        sessionId,
        messages,
        model: resendModel,
      } = (e as CustomEvent).detail
      await startChatStreaming(sessionId, messages, resendModel)
    }
    window.addEventListener("resend-message", handler)
    return () => window.removeEventListener("resend-message", handler)
  }, [isStreaming, startChatStreaming])

  return { input, setInput, handleSend, isStreaming, stopStream }
}
