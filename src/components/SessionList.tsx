import { useState } from "react"
import { Button, Divider, Dropdown, Modal } from "antd"
import {
  PlusOutlined,
  MoreOutlined,
  EditFilled,
  DeleteOutlined,
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
    <aside className="w-65 max-h-screen overflow-y-auto bg-white/90 dark:bg-gray-950/90 border-r border-blue-100 dark:border-blue-900 p-6 flex flex-col shadow-md">
      <Button
        type="primary"
        icon={<PlusOutlined />}
        className="w-full shrink-0"
        onClick={onNewSession}
      >
        新建会话
      </Button>
      <Divider />
      <div className="overflow-y-auto w-full shrink-0">
        {sessions.length === 0 ? (
          <div className="text-blue-300 dark:text-blue-800 text-sm text-center mt-16">
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
                        ? "!bg-blue-100 !text-blue-700 dark:!bg-blue-900 dark:!text-blue-200 shadow"
                        : "hover:!bg-blue-50 dark:hover:!bg-blue-800 !text-gray-700 dark:!text-gray-200"
                    }`}
                    onClick={() => onSelectSession(s.id)}
                  >
                    <span className="max-w-full pr-4 truncate text-left w-full">{s.name}</span>
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
    </aside>
  )
}
