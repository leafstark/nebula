import { useState, useEffect } from "react"
import type { Session } from "../components/SessionList"

// 引入 idb 简化 IndexedDB 操作
import { openDB } from "idb"

const DB_NAME = "nebula"
const STORE_NAME = "sessions"

async function getDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

async function getSessionsFromDB(): Promise<Session[]> {
  const db = await getDB()
  const sessions = await db.get(STORE_NAME, "all")
  return Array.isArray(sessions) ? sessions : []
}

async function saveSessionsToDB(sessions: Session[]) {
  const db = await getDB()
  await db.put(STORE_NAME, sessions, "all")
}

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // 初始化加载
  useEffect(() => {
    let cancelled = false
    getSessionsFromDB().then((loadedSessions) => {
      if (cancelled) return
      let newActiveSessionId: number | null = null
      const hashSessionIdStr = window.location.hash.substring(1)
      const hashSessionIdNum = Number(hashSessionIdStr)
      if (
        hashSessionIdStr &&
        loadedSessions.some((s) => s.id === hashSessionIdNum)
      ) {
        newActiveSessionId = hashSessionIdNum
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
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 持久化
  useEffect(() => {
    if (!isInitialized) return
    saveSessionsToDB(sessions).catch(() => {
      alert("存储空间已满，请删除部分历史会话后重试。")
    })
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
