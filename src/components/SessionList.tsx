import { useState } from "react"
import { Button, Dropdown, Modal } from "antd"
import {
  MoreOutlined,
  EditFilled,
  DeleteOutlined,
  FormOutlined,
} from "@ant-design/icons"

interface Message {
  id?: number
  content: string
  role: string
  // Add other fields as needed
}

export interface Session {
  id: number
  name: string
  messages: Message[]
  summaries?: { round: number; content: string }[] // 新增，分段摘要
  systemPrompt?: string // 新增，每个会话独立的系统提示词
}

interface Props {
  sessions: Session[]
  activeSessionId: number | null
  onNewSession: () => void
  onSelectSession: (id: number) => void
  onDeleteSession: (id: number) => void
  onRenameSession: (id: number, name: string) => void
}

export default function SessionList({
  sessions,
  activeSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}: Props) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(
    null
  )

  const showDeleteModal = (sessionId: number) => {
    setDeletingSessionId(sessionId)
    setIsDeleteModalOpen(true)
  }

  const handleDeleteOk = () => {
    if (deletingSessionId !== null) {
      onDeleteSession(deletingSessionId)
    }
    setIsDeleteModalOpen(false)
    setDeletingSessionId(null)
  }

  const handleDeleteCancel = () => {
    setIsDeleteModalOpen(false)
    setDeletingSessionId(null)
  }

  return (
    <div className="flex-1 max-h-full min-h-0 overflow-y-auto p-6 flex flex-col">
      <Button
        type="text"
        icon={<FormOutlined />}
        onClick={onNewSession}
        className="mb-6 pl-3"
      >
        <span className="text-left w-full">新聊天</span>
      </Button>
      <span className="text-neutral-400 pl-3 text-sm mb-2">聊天</span>
      <div className="w-full flex-1 max-h-full shrink-0">
        {sessions.length === 0 ? (
          <div className="text-neutral-300 text-sm text-center mt-16">
            暂无会话
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => {
              const menuItems = [
                {
                  key: "rename",
                  icon: <EditFilled />,
                  label: (
                    <span onClick={() => onRenameSession(s.id, s.name)}>
                      重命名
                    </span>
                  ),
                },
                {
                  key: "delete",
                  icon: <DeleteOutlined />,
                  label: (
                    <span onClick={() => showDeleteModal(s.id)}>删除</span>
                  ),
                },
              ]
              return (
                <li key={s.id} className="flex items-center group relative">
                  <Button
                    type="text"
                    className={`w-full pl-3 ${
                      s.id === activeSessionId
                        ? "!bg-neutral-200 shadow"
                        : "hover:!bg-neutral-200 !text-gray-700"
                    }`}
                    onClick={() => onSelectSession(s.id)}
                  >
                    <span className="max-w-full pr-4 truncate text-left w-full" title={s.name}>
                      {s.name}
                    </span>
                  </Button>
                  <Dropdown
                    trigger={["click"]}
                    menu={{ items: menuItems }}
                    placement="bottomRight"
                  >
                    <Button
                      type="text"
                      icon={<MoreOutlined />}
                      className={`right-0.5 absolute text-lg transition ${
                        s.id === activeSessionId
                          ? "flex"
                          : "hidden group-hover:flex"
                      }`}
                      title="更多操作"
                    />
                  </Dropdown>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <Modal
        title="确定要删除该会话吗？"
        open={isDeleteModalOpen}
        onOk={handleDeleteOk}
        onCancel={handleDeleteCancel}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p className="my-5"> 删除后，该对话将不可恢复。确认删除吗？</p>
      </Modal>
    </div>
  )
}
