import { useState, useEffect } from "react"
import type { Session } from "../components/SessionList"

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // 初始化加载
  useEffect(() => {
    const saved = localStorage.getItem("tiger-gpt-sessions")
    let loadedSessions: Session[] = []
    let newActiveSessionId: number | null = null
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          loadedSessions = parsed
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
        return
      }
    }
    setSessions(loadedSessions)
    if (loadedSessions.length === 0) {
      setActiveSessionId(null)
      if (window.location.hash && window.location.hash !== "#") {
        window.location.hash = ""
      }
    } else {
      setActiveSessionId(newActiveSessionId)
    }
    setIsInitialized(true)
  }, [])

  // 持久化
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

  // hash 同步
  useEffect(() => {
    if (!isInitialized) return
    if (activeSessionId !== null) {
      const sessionExists = sessions.find((s) => s.id === activeSessionId)
      if (sessionExists) {
        window.location.hash = `#${activeSessionId}`
      }
    } else {
      if (window.location.hash && window.location.hash !== "#") {
        window.location.hash = ""
      }
    }
  }, [activeSessionId, isInitialized, sessions])

  return {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    isInitialized,
  }
}
