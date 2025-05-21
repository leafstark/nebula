import { useState, useEffect } from "react"

const MODEL_LIST = [
  "gpt-4o",
  "gpt-4.1",
  "claude-3.5-sonnet",
  "claude-3.7-sonnet",
  "claude-3.7-sonnet-thought",
  "gemini-2.5-pro",
]

export function useModel(isInitialized: boolean) {
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem("tiger-gpt-model")
    return saved && MODEL_LIST.includes(saved) ? saved : MODEL_LIST[0]
  })

  useEffect(() => {
    if (!isInitialized) return
    localStorage.setItem("tiger-gpt-model", model)
  }, [model, isInitialized])

  return { model, setModel, MODEL_LIST }
}
