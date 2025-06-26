import { useState, useEffect } from "react"
import {
  Modal,
  Input,
  Button,
  Switch,
  Menu,
  Card,
  Table,
  Popconfirm,
  message,
  Form,
} from "antd"
import {
  SettingOutlined,
  BulbOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
} from "@ant-design/icons"

interface ModelConfig {
  id: string
  name?: string
}
interface ModelSourceConfig {
  name?: string
  apiKey: string
  baseUrl: string
  models: ModelConfig[]
}
interface SettingsModalProps {
  visible: boolean
  onClose: () => void
  onSaveModelSources: (configs: ModelSourceConfig[]) => void
  onSaveSummary: (summary: boolean) => void
  modelSources: ModelSourceConfig[]
  useSummary: boolean
}

const DEFAULT_MODEL_SOURCE: ModelSourceConfig = {
  name: "nebula",
  apiKey: "9qRjL7wZkXyV3sN0aP1bC5fG8hJ2mK4",
  baseUrl: "https://wings-copilot.test.tigerbrokers.net/api/v1",
  models: [
    { id: "gpt-4.1", name: "GPT-4.1" },
    { id: "claude-3.7-sonnet", name: "Claude 3.7 Sonnet" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
  ],
}

export default function SettingsModal({
  visible,
  onClose,
  onSaveModelSources,
  onSaveSummary,
  modelSources,
  useSummary,
}: SettingsModalProps) {
  const [sources, setSources] = useState<ModelSourceConfig[]>([])
  const [summary, setSummary] = useState(true)
  const [selectedSourceIdx, setSelectedSourceIdx] = useState(0)
  const [menuKey, setMenuKey] = useState("source")
  // 模型添加弹窗
  const [addModelModalVisible, setAddModelModalVisible] = useState(false)
  const [addModelForm] = Form.useForm()
  const [editingModel, setEditingModel] = useState<{
    model: ModelConfig
    index: number
  } | null>(null)

  useEffect(() => {
    if (visible) {
      setSelectedSourceIdx(0)
      setMenuKey("source")
    }
  }, [visible])

  useEffect(() => {
    if (visible) {
      // 新用户无模型源时，自动插入默认模型源
      if (!modelSources || modelSources.length === 0) {
        setSources([DEFAULT_MODEL_SOURCE])
      } else {
        setSources(modelSources)
      }
      setSummary(useSummary)
    }
  }, [visible, modelSources, useSummary])

  // 模型源字段变更，自动保存
  useEffect(() => {
    if (!visible) return
    if (JSON.stringify(sources) !== JSON.stringify(modelSources)) {
      try {
        localStorage.setItem("modelSources", JSON.stringify(sources))
        onSaveModelSources(sources)
        message.success("模型源已自动保存", 1)
      } catch {
        message.error("模型源保存失败")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources])

  // 智能长记忆变更，自动保存
  useEffect(() => {
    if (!visible) return
    if (summary !== useSummary) {
      try {
        onSaveSummary(summary)
        message.success("智能长记忆设置已保存", 1)
      } catch {
        message.error("智能长记忆保存失败")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary])

  // 模型源字段编辑
  const handleSourceChange = (
    idx: number,
    key: keyof ModelSourceConfig,
    value: string
  ) => {
    setSources((srcs) => {
      const next = [...srcs]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  // 添加模型源
  const handleAddSource = () => {
    setSources((srcs) => {
      const next = [...srcs, { name: "", apiKey: "", baseUrl: "", models: [] }]
      setSelectedSourceIdx(next.length - 1)
      return next
    })
  }

  // 删除模型源
  const handleRemoveSource = (idx: number) => {
    console.log("Removing source at index:", idx)
    setSources((srcs) => {
      const next = srcs.filter((_, i) => i !== idx)
      if (selectedSourceIdx === idx) {
        setSelectedSourceIdx(Math.max(0, idx - 1))
      } else if (selectedSourceIdx > idx) {
        setSelectedSourceIdx(selectedSourceIdx - 1)
      }
      return next
    })
  }

  // 删除模型
  const handleRemoveModel = (srcIdx: number, modelIdx: number) => {
    setSources((srcs) => {
      const next = [...srcs]
      const models = [...(next[srcIdx].models || [])]
      models.splice(modelIdx, 1)
      next[srcIdx] = { ...next[srcIdx], models }
      return next
    })
  }

  // 打开添加模型弹窗
  const handleAddModel = () => {
    setEditingModel(null)
    addModelForm.setFieldsValue({ id: "", name: "" })
    setAddModelModalVisible(true)
  }

  // 打开编辑模型弹窗
  const handleEditModel = (model: ModelConfig, index: number) => {
    setEditingModel({ model, index })
    addModelForm.setFieldsValue({ id: model.id, name: model.name || "" })
    setAddModelModalVisible(true)
  }

  // 保存模型
  const handleSaveModel = async () => {
    try {
      const values = await addModelForm.validateFields()
      setSources((srcs) => {
        const next = [...srcs]
        const models = [...(next[selectedSourceIdx].models || [])]
        if (editingModel) {
          models[editingModel.index] = { id: values.id, name: values.name }
        } else {
          models.push({ id: values.id, name: values.name })
        }
        next[selectedSourceIdx] = { ...next[selectedSourceIdx], models }
        return next
      })
      setAddModelModalVisible(false)
      setEditingModel(null)
    } catch {
      // 校验失败
    }
  }

  // 模型表格
  const getModelColumns = (sourceIdx: number) => [
    {
      title: "模型 ID",
      dataIndex: "id",
      key: "id",
      render: (text: string) => <span>{text}</span>,
    },
    {
      title: "名称（可选）",
      dataIndex: "name",
      key: "name",
      render: (text: string) => <span>{text}</span>,
    },
    {
      title: "操作",
      key: "action",
      render: (_text: string, record: ModelConfig, mIdx: number) => (
        <div className="flex items-center">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditModel(record, mIdx)}
          />
          <Popconfirm
            title="确定删除该模型？"
            onConfirm={() => handleRemoveModel(sourceIdx, mIdx)}
            okText=""
            cancelText=""
            icon={null}
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <Modal
      title={<span className="font-bold text-lg text-neutral-800">设置</span>}
      open={visible}
      onCancel={onClose}
      footer={null}
      centered
      className="max-w-400 min-w-200 w-[70vw] rounded-xl overflow-hidden"
    >
      <div className="flex min-h-100">
        <Menu
          mode="inline"
          selectedKeys={[menuKey]}
          onClick={(e) => setMenuKey(e.key)}
          className="w-48 mr-4 rounded-l-xl text-base custom-settings-menu"
          items={[
            {
              key: "source",
              icon: <SettingOutlined />,
              label: <span className="font-medium">模型源</span>,
            },
            {
              key: "memory",
              icon: <BulbOutlined />,
              label: <span className="font-medium">智能长记忆</span>,
            },
          ]}
        />
        <div className="flex-1 px-4 bg-white rounded-r-xl min-h-120">
          {menuKey === "source" && (
            <div className="flex">
              {/* 左侧模型源列表 */}
              <div className="min-w-50 pr-4 border-r border-neutral-100">
                <div>
                  {sources.map((src, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center group my-1 px-3 py-2 mb-1 rounded-lg cursor-pointer transition-all ${
                        idx === selectedSourceIdx
                          ? "bg-neutral-200/80 text-neutral-900 font-semibold"
                          : "hover:bg-neutral-100 text-neutral-700"
                      }`}
                      onClick={() => setSelectedSourceIdx(idx)}
                      tabIndex={0}
                      style={{ outline: "none" }}
                    >
                      <span className="truncate flex-1">
                        {src.name?.trim() || `模型源${idx + 1}`}
                      </span>
                      {
                        <Popconfirm
                          title="确定删除该模型源？"
                          onConfirm={(e) => {
                            e?.stopPropagation?.()
                            handleRemoveSource(idx)
                          }}
                          okText=""
                          cancelText=""
                          icon={null}
                        >
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            className="ml-2 opacity-0 group-hover:opacity-100"
                            tabIndex={-1}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </Popconfirm>
                      }
                    </div>
                  ))}
                </div>
                <Button
                  type="dashed"
                  onClick={handleAddSource}
                  block
                  className="mt-2"
                  icon={<PlusOutlined />}
                >
                  添加模型源
                </Button>
              </div>
              {/* 右侧详情 */}
              <div className="flex-1 pl-6">
                {sources[selectedSourceIdx] && (
                  <Card
                    className="border border-neutral-200 rounded-xl shadow-sm bg-neutral-50 relative"
                    title={
                      <div className="flex items-center gap-2 w-full">
                        <Input
                          value={sources[selectedSourceIdx].name || ""}
                          onChange={(e) =>
                            handleSourceChange(
                              selectedSourceIdx,
                              "name",
                              e.target.value
                            )
                          }
                          placeholder="模型源名称"
                          autoComplete="off"
                          className="rounded-lg text-base text-neutral-700 w-48"
                          maxLength={32}
                          style={{ minWidth: 0 }}
                          size="small"
                        />
                      </div>
                    }
                  >
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <Input.Password
                        value={sources[selectedSourceIdx].apiKey}
                        onChange={(e) =>
                          handleSourceChange(
                            selectedSourceIdx,
                            "apiKey",
                            e.target.value
                          )
                        }
                        placeholder="API Key"
                        autoComplete="off"
                        className="rounded-lg flex-1"
                      />
                      <Input
                        value={sources[selectedSourceIdx].baseUrl}
                        onChange={(e) =>
                          handleSourceChange(
                            selectedSourceIdx,
                            "baseUrl",
                            e.target.value
                          )
                        }
                        placeholder="Base URL"
                        autoComplete="off"
                        className="rounded-lg flex-1"
                      />
                    </div>
                    <div className="mb-2 font-medium text-neutral-700">
                      模型列表
                    </div>
                    <Table
                      dataSource={(sources[selectedSourceIdx].models || []).map(
                        (m, mIdx) => ({ ...m, key: mIdx })
                      )}
                      columns={getModelColumns(selectedSourceIdx)}
                      pagination={false}
                      size="small"
                      bordered={false}
                      className="mb-2"
                    />
                    <Button
                      type="dashed"
                      size="small"
                      onClick={handleAddModel}
                      className="mt-2"
                    >
                      添加模型
                    </Button>
                    {/* 添加/编辑模型弹窗 */}
                    <Modal
                      title={editingModel ? "编辑模型" : "添加模型"}
                      open={addModelModalVisible}
                      onCancel={() => {
                        setAddModelModalVisible(false)
                        setEditingModel(null)
                        addModelForm.resetFields()
                      }}
                      onOk={handleSaveModel}
                      okText="保存"
                      cancelText="取消"
                      destroyOnClose
                    >
                      <Form
                        form={addModelForm}
                        layout="vertical"
                        initialValues={{ id: "", name: "" }}
                      >
                        <Form.Item
                          label="模型 ID"
                          name="id"
                          rules={[{ required: true, message: "请输入模型 ID" }]}
                        >
                          <Input placeholder="模型 ID" autoFocus />
                        </Form.Item>
                        <Form.Item label="模型名称（可选）" name="name">
                          <Input placeholder="模型名称" />
                        </Form.Item>
                      </Form>
                    </Modal>
                  </Card>
                )}
              </div>
            </div>
          )}
          {menuKey === "memory" && (
            <div className="py-3">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-base text-neutral-700 font-medium select-none">
                  智能长记忆
                </span>
                <Switch
                  checked={summary}
                  onChange={(checked) => {
                    setSummary(checked)
                  }}
                  checkedChildren={null}
                  unCheckedChildren={null}
                  className={
                    `border-neutral-200 shadow-none ` +
                    (summary ? "!bg-neutral-900/90" : "!bg-neutral-200/80")
                  }
                />
              </div>
              <div className="text-xs text-neutral-500">
                启用后，系统会自动对长对话进行摘要，提升上下文理解能力。
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
