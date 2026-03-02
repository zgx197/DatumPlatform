import { useState, useRef, useEffect, useCallback } from 'react'
import { Drawer, Input, Button, Space, Tag, Alert, Spin, App as AntdApp, Tooltip, Segmented } from 'antd'
import { SendOutlined, DeleteOutlined, RobotOutlined, UserOutlined, ToolOutlined, LoadingOutlined, FontSizeOutlined } from '@ant-design/icons'
import { getUiPrefs, saveUiPrefs, CHAT_FONT_SIZES } from '../services/uiPrefs'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'
import { getActiveModel } from '../services/aiConfig'
import { streamChat, type ChatMessage } from '../services/aiChat'
import { getEffectiveKeys } from '../services/shortcuts'
import MermaidBlock from './MermaidBlock'

const { TextArea } = Input

interface Props {
  open: boolean
  onClose: () => void
}

const HISTORY_KEY = 'datum-ai-chat-history'

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(msgs: ChatMessage[]) {
  // 只保存 user 和 assistant 消息，不保存 tool 中间消息
  const toSave = msgs.filter(m => m.role === 'user' || m.role === 'assistant')
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(toSave.slice(-50))) } catch {}
}

// 打字指示器动画样式
const typingDotStyle = `
@keyframes datum-typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
.datum-typing-dot {
  display: inline-block;
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #4e9af1;
  margin: 0 2px;
  animation: datum-typing-bounce 1.4s ease-in-out infinite;
}
.datum-typing-dot:nth-child(2) { animation-delay: 0.2s; }
.datum-typing-dot:nth-child(3) { animation-delay: 0.4s; }

/* AI 气泡内的 Markdown 表格强制不溢出 */
.datum-ai-bubble table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 12px;
  margin: 6px 0;
}
.datum-ai-bubble table th,
.datum-ai-bubble table td {
  border: 1px solid #30363d;
  padding: 4px 8px;
  white-space: nowrap;
}
.datum-ai-bubble table th {
  background: #21262d;
}
.datum-ai-bubble pre {
  overflow-x: auto;
  max-width: 100%;
  background: #0d1117;
  border: 1px solid #21262d;
  border-radius: 6px;
  padding: 8px;
  margin: 6px 0;
  font-size: 12px;
}
.datum-ai-bubble code {
  font-size: 12px;
  word-break: break-all;
}
.datum-ai-bubble p { margin: 4px 0; }
.datum-ai-bubble ul, .datum-ai-bubble ol { padding-left: 18px; margin: 4px 0; }
.datum-ai-bubble li { margin: 2px 0; }
.datum-ai-bubble h1, .datum-ai-bubble h2, .datum-ai-bubble h3,
.datum-ai-bubble h4, .datum-ai-bubble h5 {
  margin: 8px 0 4px;
  font-size: 14px;
  color: #e6edf3;
}
/* KaTeX 公式暗色适配 */
.datum-ai-bubble .katex { color: #e6edf3; font-size: 1em; }
.datum-ai-bubble .katex-display { margin: 8px 0; overflow-x: auto; }
.datum-ai-bubble .katex-display > .katex { text-align: left; padding-left: 8px; }
/* Mermaid 流程图容器 */
.datum-ai-bubble .datum-mermaid-wrap { margin: 8px 0; overflow-x: auto; }
`

export default function AiChatDrawer({ open, onClose }: Props) {
  const { message: antMsg } = AntdApp.useApp()
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [toolStatus, setToolStatus] = useState('')
  const [chatFontSize, setChatFontSize] = useState(() => getUiPrefs().chatFontSize)
  const [showFontPicker, setShowFontPicker] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)

  // 监听全局 UI 偏好变更
  useEffect(() => {
    const handler = (e: Event) => {
      const prefs = (e as CustomEvent).detail
      setChatFontSize(prefs.chatFontSize)
    }
    window.addEventListener('datum-ui-prefs-change', handler)
    return () => window.removeEventListener('datum-ui-prefs-change', handler)
  }, [])

  // 注入气泡样式
  useEffect(() => {
    if (!styleRef.current) {
      const style = document.createElement('style')
      style.textContent = typingDotStyle
      document.head.appendChild(style)
      styleRef.current = style
    }
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current)
        styleRef.current = null
      }
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }, [])

  useEffect(() => { if (open) scrollToBottom() }, [open, messages, streamContent, toolStatus, loading])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const model = getActiveModel()
    if (!model) {
      antMsg.warning('请先在「设置」页面配置 AI 模型和 API Key')
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: text }
    const newMsgs = [...messages, userMsg]
    setMessages(newMsgs)
    setInput('')
    setLoading(true)
    setStreamContent('')
    setToolStatus('')

    try {
      const result = await streamChat(
        model,
        newMsgs,
        (content, done) => {
          setStreamContent(content)
          if (done) {
            setStreamContent('')
            setMessages(prev => {
              const updated = [...prev, { role: 'assistant' as const, content }]
              saveHistory(updated)
              return updated
            })
          }
        },
        (toolName) => {
          setToolStatus(`正在调用: ${toolName}`)
        },
      )
      if (result.length > 0) {
        const lastAssistant = result.filter(m => m.role === 'assistant').pop()
        if (lastAssistant) {
          setMessages(prev => {
            const lastPrev = prev[prev.length - 1]
            if (lastPrev?.role === 'assistant' && lastPrev.content === lastAssistant.content) return prev
            const clean = newMsgs.concat(lastAssistant)
            saveHistory(clean)
            return clean
          })
        }
      }
    } catch (err: any) {
      antMsg.error(`AI 请求失败: ${err?.message ?? '未知错误'}`)
      setStreamContent('')
    } finally {
      setLoading(false)
      setToolStatus('')
    }
  }

  const handleClear = () => {
    setMessages([])
    saveHistory([])
    setStreamContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 是否显示等待气泡（loading 且没有流式内容 — 即等待首个 token 或等待 tool 执行）
  const showWaitingBubble = loading && !streamContent

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined style={{ color: '#4e9af1' }} />
          <span>Datum AI 助手</span>
          <span style={{ fontSize: 11, color: '#6e7681', fontWeight: 400 }}>{getEffectiveKeys('toggle-ai-chat')}</span>
          {loading && <Spin size="small" indicator={<LoadingOutlined spin style={{ color: '#4e9af1' }} />} />}
        </Space>
      }
      open={open}
      onClose={onClose}
      width={500}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' } }}
      extra={
        <Space size={4}>
          {/* 字体大小切换 */}
          <Tooltip title="调整字体大小">
            <Button
              size="small"
              type={showFontPicker ? 'primary' : 'text'}
              icon={<FontSizeOutlined />}
              onClick={() => setShowFontPicker(p => !p)}
              style={{ color: showFontPicker ? undefined : '#8b949e' }}
            />
          </Tooltip>
          <Button size="small" type="text" icon={<DeleteOutlined />} onClick={handleClear} danger>
            清空
          </Button>
        </Space>
      }
    >
      {/* 字体大小选择浮层 */}
      {showFontPicker && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 16px',
          background: '#161b22',
          borderBottom: '1px solid #21262d',
          flexShrink: 0,
        }}>
          <FontSizeOutlined style={{ color: '#8b949e', fontSize: 12 }} />
          <span style={{ fontSize: 11, color: '#8b949e', marginRight: 4 }}>字体大小</span>
          <Segmented
            size="small"
            value={chatFontSize}
            options={CHAT_FONT_SIZES.map(s => ({ label: `${s}px`, value: s }))}
            onChange={(v) => {
              const size = v as number
              setChatFontSize(size)
              saveUiPrefs({ chatFontSize: size })
            }}
          />
        </div>
      )}

      {/* 消息列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {messages.length === 0 && !streamContent && !loading && (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#8b949e' }}>
            <RobotOutlined style={{ fontSize: 40, marginBottom: 12, color: '#4e9af1' }} />
            <div style={{ fontSize: 14, marginBottom: 8 }}>你好！我是 Datum AI 助手</div>
            <div style={{ fontSize: 12, color: '#6e7681', lineHeight: 1.8 }}>
              我可以帮你分析怪物评分、关卡难度、检测异常数据等。
              <br />试试问：
            </div>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
              {['哪些怪物 DPS 为 0？', '当前权重配置是什么？', '对比关卡难度'].map(q => (
                <Button key={q} size="small" type="dashed"
                  style={{ borderColor: '#30363d', color: '#8b949e', fontSize: 12 }}
                  onClick={() => { setInput(q) }}
                >{q}</Button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} fontSize={chatFontSize} />
        ))}

        {/* 流式输出中的内容 */}
        {streamContent && (
          <MessageBubble message={{ role: 'assistant', content: streamContent, _loading: true }} fontSize={chatFontSize} />
        )}

        {/* 等待首个 token 时的思考气泡 */}
        {showWaitingBubble && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{
              background: '#161b22',
              border: '1px solid #21262d',
              borderRadius: '12px 12px 12px 2px',
              padding: '10px 14px',
              minWidth: 120,
            }}>
              <div style={{ fontSize: 10, color: '#6e7681', marginBottom: 6 }}>
                <Space size={4}><RobotOutlined /> AI</Space>
              </div>
              {toolStatus ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" indicator={<LoadingOutlined spin style={{ fontSize: 14, color: '#4e9af1' }} />} />
                  <Tag icon={<ToolOutlined />} color="processing" style={{ margin: 0, fontSize: 11 }}>{toolStatus}</Tag>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="datum-typing-dot" />
                  <span className="datum-typing-dot" />
                  <span className="datum-typing-dot" />
                  <span style={{ fontSize: 12, color: '#6e7681', marginLeft: 4 }}>思考中...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div style={{
        borderTop: '1px solid #21262d',
        padding: '12px 16px',
        background: '#0d1117',
      }}>
        {!getActiveModel() && (
          <Alert
            type="warning"
            showIcon
            message="请先配置 AI 模型"
            description="前往「设置」页面添加 API Key"
            style={{ marginBottom: 8 }}
          />
        )}
        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送，Shift+Enter 换行)"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
            style={{ background: '#161b22', borderColor: '#21262d', color: '#c9d1d9' }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim()}
          />
        </Space.Compact>
      </div>
    </Drawer>
  )
}

/**
 * LaTeX 预处理：自动将裸 LaTeX 命令包裹成 $...$
 *
 * 问题：很多 AI 模型输出 \text{...}, \frac{...} 等但不用 $ 包裹，
 * remark-math 只识别 $...$ 和 $$...$$，裸 LaTeX 命令会被当作纯文本。
 *
 * 策略（按优先级执行）：
 * 1. 保护已有的 $$...$$ 和 $...$
 * 2. 保护代码块 ```...``` 和行内代码 `...`
 * 3. 将 \[...\] 和 \(...\) 转换为 $$...$$ 和 $...$
 * 4. 将 [...] 中含 LaTeX 命令的转为 $$...$$
 * 5. 将含裸 LaTeX 命令的片段包裹 $...$
 */
const LATEX_CMD_RE = /\\(?:text|frac|sum|prod|int|sqrt|times|cdot|div|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|sigma|omega|partial|nabla|vec|hat|bar|overline|underline|left|right|mathrm|mathbf|mathit|operatorname)\b/

function preprocessLatex(content: string): string {
  if (!content) return content

  // Step 0: 收集保护区域（代码块、已有 math），用占位符替换
  const protected_: string[] = []
  const ph = (s: string) => { protected_.push(s); return `\x00P${protected_.length - 1}\x00` }

  // 保护 ``` 代码块
  let s = content.replace(/```[\s\S]*?```/g, m => ph(m))
  // 保护 $$...$$
  s = s.replace(/\$\$[\s\S]*?\$\$/g, m => ph(m))
  // 保护 $...$（非贪婪，不跨行）
  s = s.replace(/\$(?!\$)(?:[^$\n]|\\\$)+\$/g, m => ph(m))
  // 保护行内代码 `...`
  s = s.replace(/`[^`\n]+`/g, m => ph(m))

  // Step 1: 将 \[...\] → $$...$$ 和 \(...\) → $...$
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => `$$${inner}$$`)
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => `$${inner}$`)

  // Step 2: 将 [...] 中含 LaTeX 命令的 → $$...$$
  s = s.replace(/\[([^\]\n]*?)\]/g, (_m, inner) => {
    if (LATEX_CMD_RE.test(inner)) return `$$${inner}$$`
    return _m
  })

  // Step 3: 逐行处理——检测含裸 LaTeX 命令但未包裹 $ 的片段
  s = s.split('\n').map(line => {
    // 如果行内已经没有裸 LaTeX 命令，跳过
    if (!LATEX_CMD_RE.test(line)) return line
    // 如果行内已经有 $（已处理过），跳过
    if (line.includes('$')) return line

    // 提取行首的 Markdown 标记（如 "- ", "· ", "1. ", "### " 等）
    const prefixMatch = line.match(/^(\s*(?:[-*+·•]|\d+[.)]\s*|\#{1,6})\s*)/)
    const prefix = prefixMatch ? prefixMatch[1] : ''
    const body = prefix ? line.slice(prefix.length) : line

    // 在 body 中查找包含 LaTeX 命令的片段
    // 策略：按中文标点和冒号分割，对含 LaTeX 的段落包裹 $
    const segments = body.split(/((?:：|:\s))/)
    const processed = segments.map(seg => {
      if (!LATEX_CMD_RE.test(seg)) return seg
      // 整个 segment 包含 LaTeX 命令，包裹 $
      return `$${seg.trim()}$`
    })
    return prefix + processed.join('')
  }).join('\n')

  // Step 4: 还原保护区域
  s = s.replace(/\x00P(\d+)\x00/g, (_m, i) => protected_[parseInt(i)])

  return s
}

// 自定义代码块：mermaid 走 MermaidBlock 渲染，其余走默认
function chatCodeComponent(props: any) {
  const { children, className, ...rest } = props
  const match = /language-(\w+)/.exec(className || '')
  if (match && match[1] === 'mermaid') {
    return (
      <div className="datum-mermaid-wrap">
        <MermaidBlock code={String(children).trim()} />
      </div>
    )
  }
  return <code className={className} {...rest}>{children}</code>
}

// 单条消息气泡
function MessageBubble({ message, fontSize = 13 }: { message: ChatMessage; fontSize?: number }) {
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'

  if (isTool) return null

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: '92%',
        minWidth: 0,
        background: isUser ? '#1f6feb' : '#161b22',
        border: isUser ? 'none' : '1px solid #21262d',
        borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        padding: '8px 12px',
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 10, color: isUser ? 'rgba(255,255,255,0.6)' : '#6e7681', marginBottom: 4 }}>
          {isUser ? (
            <Space size={4}><UserOutlined /> 你</Space>
          ) : (
            <Space size={4}>
              <RobotOutlined /> AI
              {message._loading && (
                <Spin size="small" indicator={<LoadingOutlined spin style={{ fontSize: 12, color: '#4e9af1' }} />} />
              )}
            </Space>
          )}
        </div>
        <div className={isUser ? '' : 'datum-ai-bubble'} style={{
          fontSize: fontSize,
          lineHeight: 1.65,
          color: isUser ? '#fff' : '#c9d1d9',
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          overflow: 'hidden',
        }}>
          {isUser ? (
            <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[[rehypeKatex, { strict: false }]]}
              components={{ code: chatCodeComponent }}
            >
              {preprocessLatex(message.content) || '...'}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
}
