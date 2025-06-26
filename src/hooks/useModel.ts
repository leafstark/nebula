import { useState, useEffect } from "react"

export function useModel(isInitialized: boolean) {
  const [model, setModel] = useState(() => {
    const saved = localStorage.getItem("nebula-model")
    return saved || "gpt-4.1"
  })

  useEffect(() => {
    if (!isInitialized) return
    localStorage.setItem("nebula-model", model)
  }, [model, isInitialized])

  return { model, setModel }
}
