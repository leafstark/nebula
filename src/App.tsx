import { useState, useEffect } from "react"
import { Select, Layout, Button } from "antd"
import {
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
} from "@ant-design/icons"

import SessionList from "./components/SessionList"
import ChatWindow from "./components/ChatWindow"
import ChatInput from "./components/ChatInput"
import RenameModal from "./components/RenameModal"
import SettingsModal from "./components/SettingsModal"
import SystemPromptModal from "./components/SystemPromptModal"
import { useSessions } from "./hooks/useSessions"
import { useModel } from "./hooks/useModel"
import { useChatStream } from "./hooks/useChatStream"
import type { Message } from "./components/ChatWindow"

// 类型定义
interface ModelConfig {
  id: string
  name?: string
}
interface ModelSourceConfig {
  name?: string // 新增：模型源名称
  apiKey: string
  baseUrl: string
  models: ModelConfig[]
}

const DEFAULT_MODEL_SOURCE: ModelSourceConfig = {
  name: import.meta.env.VITE_DEFAULT_MODEL_SOURCE_NAME || "默认模型源",
  apiKey: import.meta.env.VITE_DEFAULT_MODEL_SOURCE_API_KEY || "",
  baseUrl:
    import.meta.env.VITE_DEFAULT_MODEL_SOURCE_BASE_URL ||
    "https://api.openai.com/v1",
  models: (() => {
    const modelsStr = import.meta.env.VITE_DEFAULT_MODEL_SOURCE_MODELS
    if (modelsStr) {
      try {
        const parsed = JSON.parse(modelsStr)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch (e) {
        console.error(
          "Failed to parse VITE_DEFAULT_MODEL_SOURCE_MODELS from .env",
          e
        )
      }
    }
    return []
  })(),
}

function App() {
  // 设置弹窗
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [modelSources, setModelSources] = useState<ModelSourceConfig[]>(() => {
    const local = localStorage.getItem("modelSources")
    if (local) {
      try {
        const parsed = JSON.parse(local)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch (e) {
        console.error("Failed to parse modelSources from localStorage", e)
      }
    }
    return [DEFAULT_MODEL_SOURCE]
  })
  // 智能长记忆模式开关
  const [useSummary, setUseSummary] = useState(true)
  // 会话管理
  const {
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    isInitialized,
  } = useSessions()
  // 模型管理
  const { model, setModel } = useModel(isInitialized)
  // 系统提示词相关
  const [systemPromptModalVisible, setSystemPromptModalVisible] =
    useState(false)
  const [systemPrompt, setSystemPrompt] = useState<string>("")

  // 当 activeSessionId 变化时，同步 systemPrompt 的值
  useEffect(() => {
    if (activeSessionId) {
      const session = sessions.find((s) => s.id === activeSessionId)
      setSystemPrompt(session?.systemPrompt || "")
    }
  }, [activeSessionId, sessions])

  // 聊天输入与发送
  const { input, setInput, handleSend, isStreaming, stopStream } =
    useChatStream({
      sessions,
      setSessions,
      activeSessionId,
      setActiveSessionId,
      model,
      useSummary,
      openaiApiKey: (() => {
        const found = modelSources.find((cfg) =>
          cfg.models.some((m) => m.id === model)
        )
        return found?.apiKey || modelSources[0]?.apiKey || ""
      })(),
      openaiBaseUrl: (() => {
        const found = modelSources.find((cfg) =>
          cfg.models.some((m) => m.id === model)
        )
        return found?.baseUrl || modelSources[0]?.baseUrl || ""
      })(),
      systemPrompt,
    })

  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [renameSessionId, setRenameSessionId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [collapsed, setCollapsed] = useState(false)

  // 新增：用于延迟派发 resend 事件，避免 setSessions 闭包导致多次副作用
  const [pendingResend, setPendingResend] = useState<{
    sessionId: number
    messages: Message[]
    userMsg: Message
    model: string
  } | null>(null)

  // 保存模型源
  const handleSaveModelSources = (configs: ModelSourceConfig[]) => {
    setModelSources(configs)
    localStorage.setItem("modelSources", JSON.stringify(configs))
  }
  // 保存智能长记忆
  const handleSaveSummary = (summary: boolean) => {
    setUseSummary(summary)
  }
  // 保存系统提示词
  const handleSaveSystemPrompt = () => {
    if (activeSessionId) {
      // 更新当前活动会话的 systemPrompt
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, systemPrompt: systemPrompt } : s
        )
      )
    }
    setSystemPromptModalVisible(false)
  }

  // 新建会话
  const handleNewSession = () => {
    setActiveSessionId(null)
    setInput("")
    setSystemPrompt("")
  }
  // 切换会话
  const handleSelectSession = (id: number) => {
    setActiveSessionId(id)
  }
  // 删除会话
  const handleDeleteSession = (id: number) => {
    setSessions((prevSessions) => {
      const filtered = prevSessions.filter((s) => s.id !== id)
      if (id === activeSessionId) {
        setActiveSessionId(null)
      }
      return filtered
    })
  }

  const handleRenameSession = (id: number, name: string) => {
    setRenameSessionId(id)
    setRenameValue(name)
    setRenameModalVisible(true)
  }

  const handleRenameOk = () => {
    if (!renameSessionId || !renameValue.trim()) return
    setSessions((sessions) =>
      sessions.map((s) =>
        s.id === renameSessionId ? { ...s, name: renameValue.trim() } : s
      )
    )
    setRenameModalVisible(false)
  }

  const handleRenameCancel = () => {
    setRenameModalVisible(false)
  }

  // 重发消息（仅支持重发 assistant 消息，自动删除其后的 assistant 回复）
  const handleResendMessage = (messageId: number) => {
    if (!current) return
    const msgIdx = current.messages.findIndex((m) => m.id === messageId)
    if (msgIdx === -1) return
    const msg = current.messages[msgIdx]
    if (msg.role !== "assistant") return // 只允许 assistant 消息触发重发
    // 找到该 assistant 消息前的最近一条 user 消消息
    let userIdx = msgIdx - 1
    while (userIdx >= 0 && current.messages[userIdx].role !== "user") {
      userIdx--
    }
    if (userIdx < 0) return // 没有找到对应的 user 消息
    const userMsg = current.messages[userIdx]
    const targetSessionId = current.id
    // 只保留到 user 消息为止，插入 assistant 空消息
    setSessions((prevSessions) =>
      prevSessions.map((s) =>
        s.id === targetSessionId
          ? {
              ...s,
              messages: [
                ...s.messages.slice(0, userIdx + 1),
                {
                  role: "assistant",
                  content: "",
                  id: Date.now() + Math.floor(Math.random() * 10000),
                },
              ],
            }
          : s
      )
    )
    // 直接发起请求（模拟 handleSend 的流式请求部分）
    window.dispatchEvent(
      new CustomEvent("resend-message", {
        detail: {
          sessionId: targetSessionId,
          messages: [...current.messages.slice(0, userIdx + 1)],
          userMsg,
          model,
        },
      })
    )
  }

  // 编辑单条消息内容
  const handleEditMessage = (messageId: number, newContent: string) => {
    if (!current) return
    setSessions((prevSessions) => {
      let needResend = false
      const targetSessionId = current.id
      let userMsg: Message | null = null
      let msgIdx = -1
      const newSessions = prevSessions.map((s) => {
        if (s.id !== current.id) return s
        const newMessages = s.messages.map((m, idx) => {
          if (m.id === messageId) {
            if (m.content !== newContent) {
              needResend = true
              userMsg = { ...m, content: newContent }
              msgIdx = idx
              return userMsg
            }
          }
          return m
        })
        return { ...s, messages: newMessages }
      })
      // 只有内容变更时才重发
      if (needResend && userMsg && msgIdx !== -1) {
        // 删除该用户消息之后的所有消息（含 AI 回复），并插入 assistant 空消息
        const updatedSessions = newSessions.map((s) => {
          if (s.id !== targetSessionId) return s
          return {
            ...s,
            messages: [
              ...s.messages.slice(0, msgIdx + 1),
              {
                role: "assistant",
                content: "",
                id: Date.now() + Math.floor(Math.random() * 10000),
              },
            ],
          }
        })
        // 只做数据变更，不派发副作用
        // 通过 setPendingResend 交由 useEffect 处理副作用
        setPendingResend({
          sessionId: targetSessionId,
          messages: [
            ...newSessions
              .find((s) => s.id === targetSessionId)!
              .messages.slice(0, msgIdx + 1),
          ],
          userMsg,
          model,
        })
        return updatedSessions
      }
      return newSessions
    })
  }

  // 新增：监听 pendingResend，派发 resend-message 事件
  useEffect(() => {
    if (pendingResend) {
      window.dispatchEvent(
        new CustomEvent("resend-message", {
          detail: pendingResend,
        })
      )
      setPendingResend(null)
    }
  }, [pendingResend])

  // 移除旧的 pendingSystemPrompt 相关逻辑

  // 当前会话
  const current = sessions.find((s) => s.id === activeSessionId)

  // 模型分组：按模型源分组，分组名为模型源的名称（apiKey + baseUrl 组合或自定义名称）
  const groupedModels = modelSources.map((cfg, idx) => ({
    label: cfg.name?.trim() ? cfg.name : cfg.baseUrl || `模型源${idx + 1}`,
    options: cfg.models.map((m) => ({
      label: m.name?.trim() ? m.name : m.id,
      value: m.id,
    })),
  }))

  return (
    <Layout className="h-screen bg-gradient-to-br from-neutral-100 via-white to-neutral-100">
      {/* 侧边栏收起时，左上角触发按钮 */}
      {collapsed && (
        <Button
          size="large"
          type="text"
          icon={<MenuUnfoldOutlined />}
          onClick={() => setCollapsed(false)}
          className="fixed top-3 left-1 z-30 backdrop-blur-md"
        />
      )}
      {/* 侧边栏：会话列表 */}
      <Layout.Sider
        width={250}
        trigger={null}
        collapsed={collapsed}
        collapsible
        collapsedWidth={0}
        className="bg-neutral-50 h-full flex flex-col relative overflow-hidden"
      >
        {/* 展开时，右上角触发按钮 */}
        {!collapsed && (
          <Button
            type="text"
            size="large"
            icon={<MenuFoldOutlined />}
            onClick={() => setCollapsed(true)}
            className="absolute top-3 right-1 z-20 backdrop-blur-md"
          />
        )}
        <div className="h-16 flex items-center justify-center font-sans text-3xl font-bold tracking-tight text-neutral-700">
          Nebula
        </div>
        <SessionList
          sessions={sessions}
          activeSessionId={activeSessionId}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
        />
      </Layout.Sider>
      {/* 右侧主内容区 */}
      <Layout className="flex-1 flex flex-col min-w-0">
        {/* 顶部导航栏，仅在主内容区顶部 */}
        <Layout.Header className="w-full flex items-center justify-between px-12 py-4 bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Select
              value={model}
              onChange={setModel}
              size="large"
              variant="borderless"
              popupMatchSelectWidth={false}
              options={groupedModels}
            />
            <Button
              type="text"
              size="large"
              icon={<BulbOutlined />}
              title="系统提示词"
              onClick={() => {
                // 打开弹窗时，systemPrompt state 已通过 useEffect 与当前会话同步
                // 或保留了为新会话准备的值
                setSystemPromptModalVisible(true)
              }}
            />
          </div>
          <Button
            type="text"
            size="large"
            icon={<SettingOutlined />}
            onClick={() => setSettingsVisible(true)}
          />
        </Layout.Header>
        {/* 主体区域 */}
        <Layout.Content className="flex-1 flex flex-col">
          {/* 聊天主窗口 */}
          <section className="flex-1 flex flex-col justify-end bg-white relative min-h-0 h-full">
            <ChatWindow
              messages={current?.messages || []}
              activeSessionId={activeSessionId}
              onResendMessage={handleResendMessage}
              onEditMessage={handleEditMessage}
            />
            {/* 输入栏 */}
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={handleSend}
              activeSessionId={activeSessionId}
              isStreaming={isStreaming}
              onStopStream={stopStream}
            />
            {/* 设置弹窗 */}
            <SettingsModal
              visible={settingsVisible}
              onClose={() => setSettingsVisible(false)}
              onSaveModelSources={handleSaveModelSources}
              onSaveSummary={handleSaveSummary}
              modelSources={modelSources}
              useSummary={useSummary}
            />
          </section>
        </Layout.Content>
        {/* 会话重命名弹窗 */}
        <RenameModal
          visible={renameModalVisible}
          value={renameValue}
          setValue={setRenameValue}
          onOk={handleRenameOk}
          onCancel={handleRenameCancel}
        />
        <SystemPromptModal
          visible={systemPromptModalVisible}
          value={systemPrompt}
          setValue={setSystemPrompt}
          onOk={handleSaveSystemPrompt}
          onCancel={() => setSystemPromptModalVisible(false)}
        />
      </Layout>
    </Layout>
  )
}

export default App
