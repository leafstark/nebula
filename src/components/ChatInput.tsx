import { Input } from "antd"

interface Props {
  input: string
  setInput: (v: string) => void
  onSend: (e: React.FormEvent) => void
  activeSessionId: number | null // 新增 activeSessionId prop
}

export default function ChatInput({ input, setInput, onSend, activeSessionId }: Props) {
  const positionClass =
    activeSessionId === null
      ? "top-1/3 -translate-y-1/2" // 新会话时居中
      : "bottom-8" // 已有会话时在底部

  return (
    <form
      className={`absolute left-1/2 -translate-x-1/2 z-30 flex items-end gap-3 bg-white/80 dark:bg-gray-950/80 border border-blue-100 dark:border-blue-900 rounded-xl shadow-xl px-6 py-4 backdrop-blur-md ${positionClass}`}
      style={{ width: "min(720px,90vw)" }}
      onSubmit={onSend}
    >
      {activeSessionId === null && !input.trim() && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 text-blue-300 dark:text-blue-800 text-xl text-center select-none whitespace-nowrap">
          开始新的对话吧！
        </div>
      )}
      <Input.TextArea
        className="flex-1 resize-none rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-gray-800 p-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-20 shadow-inner transition"
        placeholder="输入你的问题..."
        autoSize={{ minRows: 1, maxRows: 6 }}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onPressEnter={(e) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!e.shiftKey && !(e.nativeEvent as any).isComposing) {
            e.preventDefault()
            if (input.trim()) onSend(e)
          }
        }}
      />
    </form>
  )
}
