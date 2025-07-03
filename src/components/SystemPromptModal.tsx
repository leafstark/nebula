import { Input, Button } from "antd"

interface Props {
  visible: boolean
  value: string
  setValue: (v: string) => void
  onOk: () => void
  onCancel: () => void
}

export default function SystemPromptModal({
  visible,
  value,
  setValue,
  onOk,
  onCancel,
}: Props) {
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl p-8 min-w-[360px] max-w-[90vw] w-full flex flex-col gap-5 border border-neutral-100">
        <div className="text-xl font-bold mb-2 text-neutral-800">系统提示词</div>
        <Input.TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) onOk()
          }}
          autoSize={{ minRows: 4, maxRows: 8 }}
          maxLength={2000}
          placeholder="请输入系统提示词（为空则使用默认行为）"
          className="rounded-lg border border-neutral-200 bg-neutral-50 text-base text-neutral-800 focus:border-neutral-400 focus:bg-white transition"
          autoFocus
        />
        <div className="flex gap-4 justify-center mt-2">
          <Button
            onClick={onCancel}
            className="rounded-lg px-6 py-2 text-base border border-neutral-200 bg-white hover:bg-neutral-100"
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={onOk}
            className="rounded-lg px-6 py-2 text-base custom-settings-save-btn"
          >
            确定
          </Button>
        </div>
      </div>
    </div>
  )
}
