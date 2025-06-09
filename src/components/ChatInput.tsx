import { Input } from "antd"

interface Props {
  input: string
  setInput: (v: string) => void
  onSend: (e: React.FormEvent) => void
  activeSessionId: number | null // 新增 activeSessionId prop
}

export default function ChatInput({
  input,
  setInput,
  onSend,
  activeSessionId,
}: Props) {
  const positionClass =
    activeSessionId === null
      ? "top-2/5 -translate-y-1/2" // 新会话时居中
      : "bottom-8" // 已有会话时在底部

  return (
    <div className={`px-4 absolute left-1/2 -translate-x-1/2 z-30 ${positionClass} w-full max-w-2xl`}>
      <form
        className={`gap-3 bg-white/80 border border-neutral-50 rounded-xl shadow-xl px-4 py-4 backdrop-blur-md`}
        onSubmit={onSend}
      >
        {activeSessionId === null && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 text-neutral-300 text-xl text-center select-none whitespace-nowrap">
            开始新的对话吧！
          </div>
        )}
        <Input.TextArea
          className="w-full resize-none rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-gray-900 focus:outline-none focus:ring-1 focus:ring-neutral-300 min-h-20 shadow-inner transition"
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
    </div>
  )
}
