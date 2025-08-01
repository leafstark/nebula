import { Input, Button } from "antd"
import { UpCircleFilled } from "@ant-design/icons"

interface Props {
  input: string
  setInput: (v: string) => void
  onSend: (e: React.FormEvent) => void
  activeSessionId: number | null // 新增 activeSessionId prop
  isStreaming: boolean
  onStopStream: () => void
  isEditing?: boolean
  onCancelEdit?: () => void
}

export default function ChatInput({
  input,
  setInput,
  onSend,
  activeSessionId,
  isStreaming,
  onStopStream,
  isEditing,
  onCancelEdit,
}: Props) {
  const positionClass =
    activeSessionId === null ? "top-2/5 -translate-y-1/2" : "bottom-8"

  return (
    <div
      className={`px-4 absolute left-1/2 -translate-x-1/2 z-30 ${positionClass} w-full max-w-2xl`}
    >
      <form
        className="relative flex flex-col items-stretch bg-white/80 border border-neutral-100 rounded-2xl shadow-xl px-6 py-5 backdrop-blur-md"
        onSubmit={onSend}
      >
        <div className="flex items-center w-full">
          {/* 输入框 */}
          <Input.TextArea
            className="flex-1 border-0 focus:border-0 resize-none bg-transparent text-base px-0 py-1 shadow-none focus:shadow-none min-h-0 max-h-32"
            style={{ boxShadow: "none", background: "transparent" }}
            placeholder="询问任何问题"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              if (!e.shiftKey && !(e.nativeEvent as any).isComposing) {
                e.preventDefault()
                if (input.trim() && !isStreaming) onSend(e)
              }
            }}
            variant="borderless"
          />
        </div>
        {/* 按钮区：居中放在输入框下方 */}
        <div className="flex justify-end items-center mt-4">
          {isEditing && (
            <Button type="text" onClick={onCancelEdit} className="mr-2">
              取消
            </Button>
          )}
          {isStreaming ? (
            <Button
              type="text"
              size="large"
              icon={
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-3xl"
                >
                  <circle cx="14" cy="14" r="14" fill="black" />
                  <rect x="8" y="8" width="12" height="12" fill="white" />
                </svg>
              }
              onClick={onStopStream}
              tabIndex={0}
              aria-label="终止"
            />
          ) : (
            <Button
              type="text"
              size="large"
              icon={<UpCircleFilled className="text-3xl" />}
              htmlType="submit"
              disabled={!input.trim()}
              tabIndex={0}
              aria-label={isEditing ? "确认修改" : "发送"}
            />
          )}
        </div>
      </form>
    </div>
  )
}
