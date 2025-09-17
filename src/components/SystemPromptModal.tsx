import { Input, Button } from "antd"
import { useTranslation } from "react-i18next"

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
  const { t } = useTranslation()
  if (!visible) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl p-8 min-w-[360px] max-w-[30vw] w-full flex flex-col gap-5 border border-neutral-100">
        <div className="text-xl font-bold mb-2 text-neutral-800">
          {t("system.prompt")}
        </div>
        <Input.TextArea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) onOk()
          }}
          autoSize={{ minRows: 4, maxRows: 8 }}
          maxLength={2000}
          placeholder={t("system.prompt.placeholder")}
          className="rounded-lg border border-neutral-200 bg-neutral-50 text-base text-neutral-800 focus:border-neutral-400 focus:bg-white transition"
          autoFocus
        />
        <div className="flex gap-4 justify-end mt-2">
          <Button
            onClick={onCancel}
            className="rounded-lg px-6 py-2 text-base border border-neutral-200 bg-white hover:bg-neutral-100"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="primary"
            onClick={onOk}
            className="rounded-lg px-6 py-2 text-base custom-settings-save-btn"
          >
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  )
}
