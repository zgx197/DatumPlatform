import { Card, Typography, Space, Descriptions, Button, Input, Select, Table, Popconfirm, Tag, Switch, Segmented, App as AntdApp } from 'antd'
import { PlusOutlined, DeleteOutlined, CheckOutlined, UndoOutlined, FontSizeOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../../api/client'
import {
  getModels, saveModels, getActiveModelId, setActiveModelId,
  createDefaultModel, DEFAULT_PROVIDERS,
  type AiModelConfig,
} from '../../services/aiConfig'
import {
  getAllShortcuts, getOverrides, saveOverrides, eventToKeyString,
} from '../../services/shortcuts'
import {
  getAllRules, toggleRule, addCustomRule, removeCustomRule,
  type PromptRule,
} from '../../services/promptRules'
import {
  getUiPrefs, saveUiPrefs, CHAT_FONT_SIZES, CONTENT_SCALES,
} from '../../services/uiPrefs'

const { Title, Text } = Typography

export default function Settings() {
  const { message } = AntdApp.useApp()
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: () => api.get('/health').then(r => r.data),
  })

  // ─── AI 模型配置 ───
  const [models, setModelsState] = useState<AiModelConfig[]>(getModels)
  const [activeId, setActiveId] = useState(getActiveModelId)
  const [addProvider, setAddProvider] = useState<AiModelConfig['provider']>('kimi')
  const [addKey, setAddKey] = useState('')
  const [addName, setAddName] = useState('')

  const refreshModels = () => {
    setModelsState(getModels())
    setActiveId(getActiveModelId())
  }

  const handleAdd = () => {
    if (!addKey.trim()) { message.warning('请输入 API Key'); return }
    const m = createDefaultModel(addProvider, addKey.trim(), addName.trim() || undefined)
    const updated = [...models, m]
    saveModels(updated)
    if (updated.length === 1) setActiveModelId(m.id)
    setAddKey('')
    setAddName('')
    refreshModels()
    message.success(`已添加模型: ${m.name}`)
  }

  const handleDelete = (id: string) => {
    const updated = models.filter(m => m.id !== id)
    saveModels(updated)
    if (activeId === id && updated.length > 0) setActiveModelId(updated[0].id)
    refreshModels()
  }

  const handleSetActive = (id: string) => {
    setActiveModelId(id)
    setActiveId(id)
    message.success('已切换默认模型')
  }

  const handleUpdateField = (id: string, field: keyof AiModelConfig, value: string) => {
    const updated = models.map(m => m.id === id ? { ...m, [field]: value } : m)
    saveModels(updated)
    refreshModels()
  }

  const modelColumns = [
    {
      title: '名称', dataIndex: 'name', width: 100,
      render: (v: string, row: AiModelConfig) => (
        <Input size="small" value={v} style={{ width: 90 }}
          onChange={e => handleUpdateField(row.id, 'name', e.target.value)} />
      ),
    },
    {
      title: '提供商', dataIndex: 'provider', width: 80,
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '模型', dataIndex: 'model', width: 140,
      render: (v: string, row: AiModelConfig) => (
        <Input size="small" value={v} style={{ width: 130 }}
          onChange={e => handleUpdateField(row.id, 'model', e.target.value)} />
      ),
    },
    {
      title: 'API Key', dataIndex: 'apiKey', width: 160,
      render: (v: string, row: AiModelConfig) => (
        <Input.Password size="small" value={v} style={{ width: 150 }}
          onChange={e => handleUpdateField(row.id, 'apiKey', e.target.value)} />
      ),
    },
    {
      title: 'Base URL', dataIndex: 'baseUrl', width: 180,
      render: (v: string, row: AiModelConfig) => (
        <Input size="small" value={v} style={{ width: 170 }}
          onChange={e => handleUpdateField(row.id, 'baseUrl', e.target.value)} />
      ),
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_: any, row: AiModelConfig) => (
        <Space size={4}>
          {activeId === row.id ? (
            <Tag color="green">当前</Tag>
          ) : (
            <Button size="small" type="link" icon={<CheckOutlined />}
              onClick={() => handleSetActive(row.id)}>启用</Button>
          )}
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(row.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ─── 快捷键配置 ───
  const [shortcuts, setShortcuts] = useState(getAllShortcuts)
  const [recordingId, setRecordingId] = useState<string | null>(null)

  const refreshShortcuts = useCallback(() => setShortcuts(getAllShortcuts()), [])

  // 录入快捷键：监听下一个按键组合
  useEffect(() => {
    if (!recordingId) return
    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const keyStr = eventToKeyString(e)
      if (!keyStr) return // 纯修饰键，继续等
      const overrides = getOverrides()
      const sc = shortcuts.find(s => s.id === recordingId)
      if (keyStr === sc?.defaultKeys) {
        // 和默认一样，删除覆盖
        delete overrides[recordingId]
      } else {
        overrides[recordingId] = keyStr
      }
      saveOverrides(overrides)
      setRecordingId(null)
      refreshShortcuts()
      message.success(`快捷键已更新: ${keyStr}`)
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [recordingId, shortcuts, refreshShortcuts, message])

  const handleResetShortcut = (id: string) => {
    const overrides = getOverrides()
    delete overrides[id]
    saveOverrides(overrides)
    refreshShortcuts()
    message.success('已恢复默认快捷键')
  }

  const handleResetAllShortcuts = () => {
    saveOverrides({})
    refreshShortcuts()
    message.success('已恢复所有默认快捷键')
  }

  const shortcutColumns = [
    {
      title: '功能', dataIndex: 'label', width: 100,
      render: (v: string, row: any) => (
        <span>
          <span style={{ fontWeight: 500 }}>{v}</span>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{row.description}</Text>
        </span>
      ),
    },
    {
      title: '当前快捷键', dataIndex: 'currentKeys', width: 160,
      render: (v: string, row: any) => {
        const isRecording = recordingId === row.id
        return (
          <Button
            size="small"
            type={isRecording ? 'primary' : 'default'}
            danger={isRecording}
            onClick={() => setRecordingId(isRecording ? null : row.id)}
            style={{
              minWidth: 120,
              fontFamily: 'monospace',
              fontSize: 12,
              ...(isRecording ? {} : { borderColor: '#30363d', color: '#c9d1d9', background: '#0d1117' }),
            }}
          >
            {isRecording ? '按下新快捷键...' : v}
          </Button>
        )
      },
    },
    {
      title: '默认', dataIndex: 'defaultKeys', width: 100,
      render: (v: string) => <Tag style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</Tag>,
    },
    {
      title: '', key: 'actions', width: 60,
      render: (_: any, row: any) => row.isCustom ? (
        <Button size="small" type="text" icon={<UndoOutlined />}
          onClick={() => handleResetShortcut(row.id)}
          style={{ color: '#8b949e' }}
        />
      ) : null,
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <Title level={4} style={{ margin: 0 }}>设置</Title>

      <DisplaySettingsCard />

      <Card title="AI 模型配置" size="small"
        extra={<Text type="secondary" style={{ fontSize: 11 }}>API Key 仅存储在浏览器本地，不会发送到 Datum 后端</Text>}
      >
        <Space style={{ marginBottom: 12 }} wrap>
          <Select value={addProvider} onChange={setAddProvider} style={{ width: 110 }}
            options={[
              { value: 'kimi', label: 'Kimi' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'custom', label: '自定义' },
            ]}
          />
          <Input placeholder="显示名称（可选）" value={addName} onChange={e => setAddName(e.target.value)}
            style={{ width: 120 }} />
          <Input.Password placeholder="API Key" value={addKey} onChange={e => setAddKey(e.target.value)}
            style={{ width: 260 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加</Button>
        </Space>

        {models.length > 0 ? (
          <Table rowKey="id" dataSource={models} columns={modelColumns} size="small"
            pagination={false} scroll={{ x: 800 }} />
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>
            暂未配置 AI 模型。添加后即可在侧边栏使用 AI 助手聊天。
          </Text>
        )}
      </Card>

      <Card title="快捷键" size="small"
        extra={
          <Button size="small" type="text" onClick={handleResetAllShortcuts}
            icon={<UndoOutlined />} style={{ color: '#8b949e' }}>
            全部恢复默认
          </Button>
        }
      >
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
          点击快捷键按钮可录入新的按键组合。自定义快捷键存储在浏览器本地。
        </Text>
        <Table
          rowKey="id"
          dataSource={shortcuts}
          columns={shortcutColumns}
          size="small"
          pagination={false}
          showHeader={false}
        />
      </Card>

      <PromptRulesCard />

      <Card title="系统信息" size="small">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="版本">{data?.version ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="数据目录">{data?.dataDir ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="服务地址">http://localhost:7000</Descriptions.Item>
          <Descriptions.Item label="前端版本">React 18 + Vite 6 + Ant Design 5</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )
}

// ─── 显示设置卡片 ───
function DisplaySettingsCard() {
  const [chatFontSize, setChatFontSizeState] = useState(() => getUiPrefs().chatFontSize)

  // 监听其他地方（如 AiChatDrawer）对偏好的修改，保持同步
  useEffect(() => {
    const handler = (e: Event) => {
      const prefs = (e as CustomEvent).detail
      setChatFontSizeState(prefs.chatFontSize)
    }
    window.addEventListener('datum-ui-prefs-change', handler)
    return () => window.removeEventListener('datum-ui-prefs-change', handler)
  }, [])

  const handleChatFontSize = (v: number | string) => {
    const size = v as number
    setChatFontSizeState(size)
    saveUiPrefs({ chatFontSize: size })
  }

  return (
    <Card title="显示设置" size="small">
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
        调整界面显示偏好，设置自动保存到浏览器本地。
      </Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* AI 聊天字体大小 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <FontSizeOutlined style={{ color: '#8b949e', fontSize: 14, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 500, marginBottom: 6 }}>
              AI 聊天字体大小
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 400, marginLeft: 8 }}>
                影响 AI 回复内容的字体大小，适合不同分辨率和缩放比例
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Segmented
                value={chatFontSize}
                options={CHAT_FONT_SIZES.map(s => ({ label: `${s}px`, value: s }))}
                onChange={handleChatFontSize}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                当前：{chatFontSize}px（也可在 AI 助手标题栏 <FontSizeOutlined /> 按钮快捷切换）
              </Text>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Prompt 规则管理卡片 ───
function PromptRulesCard() {
  const { message } = AntdApp.useApp()
  const [rules, setRules] = useState<PromptRule[]>(getAllRules)
  const [showAdd, setShowAdd] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrompt, setNewPrompt] = useState('')

  const refresh = () => setRules(getAllRules())

  const handleToggle = (id: string, enabled: boolean) => {
    toggleRule(id, enabled)
    refresh()
  }

  const handleAdd = () => {
    if (!newLabel.trim() || !newPrompt.trim()) {
      message.warning('请填写规则名称和 Prompt 指令')
      return
    }
    addCustomRule(newLabel.trim(), newDesc.trim(), newPrompt.trim())
    setNewLabel('')
    setNewDesc('')
    setNewPrompt('')
    setShowAdd(false)
    refresh()
    message.success('已添加自定义规则')
  }

  const handleRemove = (id: string) => {
    removeCustomRule(id)
    refresh()
    message.success('已删除自定义规则')
  }

  const builtinRules = rules.filter(r => r.builtin)
  const customRules = rules.filter(r => !r.builtin)
  const enabledCount = rules.filter(r => r.enabled).length

  return (
    <Card
      title="AI 输出规则"
      size="small"
      extra={
        <Space size={8}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {enabledCount}/{rules.length} 条规则已启用
          </Text>
          <Button size="small" type="primary" ghost icon={<PlusOutlined />}
            onClick={() => setShowAdd(!showAdd)}>
            自定义规则
          </Button>
        </Space>
      }
    >
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
        启用的规则将注入到 AI 的 System Prompt 中，控制 AI 的输出格式和行为。更改后下次对话立即生效。
      </Text>

      {/* 内置规则列表 */}
      <div style={{ marginBottom: customRules.length > 0 || showAdd ? 16 : 0 }}>
        {builtinRules.map(rule => (
          <div key={rule.id} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '8px 0', borderBottom: '1px solid #21262d',
          }}>
            <Switch size="small" checked={rule.enabled}
              onChange={v => handleToggle(rule.id, v)} style={{ marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 13, color: '#c9d1d9' }}>
                {rule.label}
                <Tag color="default" style={{ fontSize: 10, marginLeft: 6, verticalAlign: 'middle' }}>内置</Tag>
              </div>
              <Text type="secondary" style={{ fontSize: 11 }}>{rule.description}</Text>
            </div>
          </div>
        ))}
      </div>

      {/* 自定义规则列表 */}
      {customRules.length > 0 && (
        <div style={{ marginBottom: showAdd ? 16 : 0 }}>
          <Text style={{ fontSize: 12, color: '#8b949e', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            自定义规则
          </Text>
          {customRules.map(rule => (
            <div key={rule.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              padding: '8px 0', borderBottom: '1px solid #21262d',
            }}>
              <Switch size="small" checked={rule.enabled}
                onChange={v => handleToggle(rule.id, v)} style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#c9d1d9' }}>{rule.label}</div>
                <Text type="secondary" style={{ fontSize: 11 }}>{rule.description}</Text>
              </div>
              <Popconfirm title="确认删除？" onConfirm={() => handleRemove(rule.id)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} style={{ flexShrink: 0 }} />
              </Popconfirm>
            </div>
          ))}
        </div>
      )}

      {/* 新增自定义规则表单 */}
      {showAdd && (
        <div style={{
          background: '#161b22', border: '1px solid #21262d', borderRadius: 6,
          padding: 12, marginTop: 8,
        }}>
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Input placeholder="规则名称（如：代码格式化）" value={newLabel}
              onChange={e => setNewLabel(e.target.value)} size="small" />
            <Input placeholder="规则说明（可选，帮助理解规则用途）" value={newDesc}
              onChange={e => setNewDesc(e.target.value)} size="small" />
            <Input.TextArea
              placeholder="Prompt 指令（将注入到 System Prompt 中，例如：回答时优先使用代码示例说明问题）"
              value={newPrompt} onChange={e => setNewPrompt(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 4 }} size="small"
            />
            <Space>
              <Button size="small" type="primary" onClick={handleAdd}>添加</Button>
              <Button size="small" onClick={() => setShowAdd(false)}>取消</Button>
            </Space>
          </Space>
        </div>
      )}
    </Card>
  )
}
