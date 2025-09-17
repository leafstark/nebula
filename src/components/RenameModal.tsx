import { Input, Button } from "antd"
import { useTranslation } from "react-i18next"

interface Props {
  visible: boolean
  value: string
  setValue: (v: string) => void
  onOk: () => void
  onCancel: () => void
}

export default function RenameModal({
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
      <div className="bg-white rounded-xl shadow-xl p-8 min-w-[320px] flex flex-col gap-4">
        <div className="text-lg font-bold mb-2">
          {t("session.renameDialog")}
        </div>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onPressEnter={onOk}
          maxLength={30}
          autoFocus
        />
        <div className="flex gap-3 justify-center mt-2">
          <Button onClick={onCancel}>{t("common.cancel")}</Button>
          <Button type="primary" onClick={onOk} disabled={!value.trim()}>
            {t("common.ok")}
          </Button>
        </div>
      </div>
    </div>
  )
}
