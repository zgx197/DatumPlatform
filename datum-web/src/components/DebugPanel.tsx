import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Drawer, Radio, Tag, Tooltip, Typography, message as antMessage } from 'antd'
import {
  BugOutlined,
  ClearOutlined,
  CopyOutlined,
  CloseOutlined,
  RobotOutlined,
} from '@ant-design/icons'

const { Text } = Typography

export type LogLevel = 'error' | 'warn' | 'info'

/** API 错误的结构化信息（由 client.ts 拦截器写入 err.apiError） */
export interface ApiErrorMeta {
  type: 'API_ERROR'
  method: string
  url: string
  status: number
  statusText: string
  detail: string | null
  body: string | null
}

export interface LogEntry {
  id: number
  level: LogLevel
  /** 对人类友好的一行摘要 */
  message: string
  /** 简化后的调用栈（仅项目文件，最多 5 帧） */
  shortStack?: string
  /** 完整原始调用栈（可选展开） */
  fullStack?: string
  /** API 错误专属元数据 */
  apiError?: ApiErrorMeta
  time: string
}

// ─── 全局日志注册点 ──────────────────────────────────────────────────────────
let _addLog: ((entry: Omit<LogEntry, 'id' | 'time'>) => void) | null = null
let _counter = 0

function formatTime(d: Date) {
  return d.toTimeString().slice(0, 8)
}

// ─── 堆栈简化：只保留 src/ 下的项目文件帧，最多 5 条，去掉 node_modules ─────
function simplifyStack(raw: string | undefined): { short: string; full: string } | undefined {
  if (!raw) return undefined
  const lines = raw.split('\n')
  // 取包含 src/ 的帧（项目代码），过滤掉 node_modules / webpack internals
  const projectFrames = lines.filter(l =>
    l.includes('/src/') && !l.includes('node_modules') && l.trim().startsWith('at ')
  )
  const kept = projectFrames.slice(0, 5)
  // 把完整路径简化为 src/xxx.tsx:L 格式
  const shortened = kept.map(l => {
    const m = l.match(/\(?(https?:\/\/[^)]+src\/([^)]+))\)?/)
    return m ? `  at ${m[2]}` : l.trim()
  })
  return {
    short: shortened.join('\n') || lines[1]?.trim() || '',
    full: raw,
  }
}

// ─── 从 console.error 的参数里提取 API 错误元数据 ────────────────────────────
function extractApiError(args: unknown[]): ApiErrorMeta | undefined {
  for (const a of args) {
    if (a && typeof a === 'object' && (a as any).apiError?.type === 'API_ERROR') {
      return (a as any).apiError as ApiErrorMeta
    }
  }
  return undefined
}

// ─── 把 console.error 参数格式化成一行人类可读摘要 ───────────────────────────
function formatMessage(args: unknown[]): string {
  return args
    .map(a => {
      if (a instanceof Error) return a.message
      if (typeof a === 'string') return a
      try { return JSON.stringify(a) } catch { return String(a) }
    })
    .join(' ')
    .slice(0, 400)
}

export function installGlobalHandlers() {
  const origError = console.error.bind(console)
  const origWarn  = console.warn.bind(console)

  console.error = (...args: unknown[]) => {
    origError(...args)
    // 过滤已知噪音：SignalR 连接协商失败（后端未启动时的预期行为）
    const msg = formatMessage(args)
    if (msg.includes('Failed to start the connection') || msg.includes('stopped during negotiation')) return
    const apiMeta = extractApiError(args)
    const err = args.find(a => a instanceof Error) as Error | undefined
    const stk = simplifyStack(err?.stack)
    _addLog?.({
      level: 'error',
      message: msg,
      shortStack: stk?.short,
      fullStack: stk?.full,
      apiError: apiMeta,
    })
  }

  console.warn = (...args: unknown[]) => {
    origWarn(...args)
    // 过滤已知噪音：KaTeX Unicode 字符在数学模式中的警告（中文公式的预期行为）
    const warnMsg = formatMessage(args)
    if (warnMsg.includes('unicodeTextInMathMode')) return
    _addLog?.({
      level: 'warn',
      message: warnMsg,
    })
  }

  window.onerror = (_msg, _src, _line, _col, err) => {
    const stk = simplifyStack(err?.stack)
    _addLog?.({
      level: 'error',
      message: err?.message ?? String(_msg),
      shortStack: stk?.short,
      fullStack: stk?.full,
    })
  }

  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason
    const msg = reason instanceof Error ? reason.message : String(reason)
    // 过滤已知噪音：SignalR 连接协商失败（后端未启动时的预期行为，App.tsx 已静默处理）
    if (msg.includes('Failed to start the connection') || msg.includes('stopped during negotiation')) return
    const stk = simplifyStack(reason instanceof Error ? reason.stack : undefined)
    _addLog?.({
      level: 'error',
      message: msg,
      shortStack: stk?.short,
      fullStack: stk?.full,
    })
  })
}

// ─── 样式常量 ──────────────────────────────────────────────────────────────
const LEVEL_COLOR: Record<LogLevel, string> = {
  error: '#f85149',
  warn:  '#d29922',
  info:  '#58a6ff',
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: 'ERR',
  warn:  'WARN',
  info:  'INFO',
}

// ─── AI 友好摘要格式化 ────────────────────────────────────────────────────────
function buildAiReport(logs: LogEntry[]): string {
  const errors = logs.filter(l => l.level === 'error')
  const warns  = logs.filter(l => l.level === 'warn')
  const lines: string[] = [
    `# DatumPlatform 前端错误报告`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `错误 ${errors.length} 条 | 警告 ${warns.length} 条`,
    '',
  ]

  if (errors.length > 0) {
    lines.push('## Errors')
    errors.forEach((l, i) => {
      lines.push(`### ${i + 1}. [${l.time}] ${l.message}`)
      if (l.apiError) {
        const a = l.apiError
        lines.push(`- **类型**: API 请求失败`)
        lines.push(`- **请求**: \`${a.method} ${a.url}\``)
        lines.push(`- **状态**: ${a.status || 'NETWORK_ERR'} ${a.statusText}`)
        if (a.detail) lines.push(`- **后端错误**: ${a.detail}`)
        if (a.body)   lines.push(`- **响应体**: \`${a.body}\``)
      }
      if (l.shortStack) {
        lines.push('- **调用位置**:')
        lines.push('```')
        lines.push(l.shortStack)
        lines.push('```')
      }
      lines.push('')
    })
  }

  if (warns.length > 0) {
    lines.push('## Warnings')
    warns.forEach((l, i) => {
      lines.push(`${i + 1}. [${l.time}] ${l.message}`)
    })
    lines.push('')
  }

  return lines.join('\n')
}

// ─── 组件主体 ──────────────────────────────────────────────────────────────
type FilterLevel = 'all' | 'error' | 'warn'

interface DebugPanelProps {
  externalOpen?: boolean
  onExternalClose?: () => void
}

export default function DebugPanel({ externalOpen, onExternalClose }: DebugPanelProps = {}) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [internalOpen, setInternalOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  // 合并内部和外部的 open 状态
  const open = internalOpen || !!externalOpen
  const setOpen = (v: boolean) => {
    setInternalOpen(v)
    if (!v && onExternalClose) onExternalClose()
  }
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filter, setFilter] = useState<FilterLevel>('all')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    _addLog = (entry) => {
      const newEntry: LogEntry = { ...entry, id: ++_counter, time: formatTime(new Date()) }
      // 延迟到微任务，避免在其他组件渲染期间同步 setState（React 18 严格模式警告）
      queueMicrotask(() => {
        setLogs(prev => [...prev.slice(-299), newEntry])
        setUnread(prev => prev + 1)
      })
    }
    return () => { _addLog = null }
  }, [])

  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [open, logs])

  const displayed = filter === 'all' ? logs : logs.filter(l => l.level === filter)
  const errorCount = logs.filter(l => l.level === 'error').length
  const warnCount  = logs.filter(l => l.level === 'warn').length

  function copyAiReport() {
    navigator.clipboard.writeText(buildAiReport(logs))
    antMessage.success('AI 报告已复制到剪贴板')
  }

  function copyRaw() {
    const text = logs
      .map(l => `[${l.time}][${l.level.toUpperCase()}] ${l.message}${l.shortStack ? '\n' + l.shortStack : ''}`)
      .join('\n---\n')
    navigator.clipboard.writeText(text)
    antMessage.success('原始日志已复制')
  }

  return (
    <>
      <Tooltip title={`调试面板${unread > 0 ? `（${unread} 条新消息）` : ''}`} placement="right">
        <Badge count={unread} size="small" offset={[-4, 4]}>
          <Button
            type="text"
            icon={<BugOutlined />}
            onClick={() => setOpen(true)}
            style={{
              color: errorCount > 0 ? '#f85149' : '#8b949e',
              width: '100%',
              textAlign: 'left',
              borderRadius: 6,
              padding: '4px 12px',
              height: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            调试信息
            {errorCount > 0 && (
              <Tag color="error" style={{ marginLeft: 'auto', fontSize: 10, padding: '0 4px', lineHeight: '16px' }}>
                {errorCount}
              </Tag>
            )}
          </Button>
        </Badge>
      </Tooltip>

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BugOutlined style={{ color: '#4e9af1' }} />
            <span>调试信息</span>
            <div style={{ marginLeft: 8, display: 'flex', gap: 4 }}>
              {errorCount > 0 && <Tag color="error"  style={{ fontSize: 10 }}>{errorCount} 错误</Tag>}
              {warnCount  > 0 && <Tag color="warning" style={{ fontSize: 10 }}>{warnCount} 警告</Tag>}
            </div>
          </div>
        }
        placement="left"
        width={600}
        open={open}
        onClose={() => setOpen(false)}
        styles={{
          body: { padding: 0, background: '#0d1117', display: 'flex', flexDirection: 'column' },
          header: { background: '#161b22', borderBottom: '1px solid #21262d' },
        }}
        closeIcon={<CloseOutlined style={{ color: '#8b949e' }} />}
        extra={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Tooltip title="复制 AI 可读报告（Markdown 格式，方便粘贴给 AI 分析）">
              <Button size="small" icon={<RobotOutlined />} onClick={copyAiReport} disabled={logs.length === 0}>
                给 AI
              </Button>
            </Tooltip>
            <Tooltip title="复制原始日志">
              <Button size="small" icon={<CopyOutlined />} onClick={copyRaw} disabled={logs.length === 0}>
                复制
              </Button>
            </Tooltip>
            <Tooltip title="清空">
              <Button
                size="small" icon={<ClearOutlined />} danger
                onClick={() => { setLogs([]); setUnread(0); setExpandedId(null) }}
                disabled={logs.length === 0}
              />
            </Tooltip>
          </div>
        }
      >
        {/* 过滤栏 */}
        <div style={{
          padding: '8px 12px',
          borderBottom: '1px solid #21262d',
          background: '#161b22',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <Radio.Group
            size="small"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="all">全部 {logs.length}</Radio.Button>
            <Radio.Button value="error">错误 {errorCount}</Radio.Button>
            <Radio.Button value="warn">警告 {warnCount}</Radio.Button>
          </Radio.Group>
          <Text style={{ fontSize: 11, color: '#484f58', marginLeft: 'auto' }}>
            点击条目可展开调用位置
          </Text>
        </div>

        {/* 日志列表 */}
        <div style={{ flex: 1, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12 }}>
          {displayed.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: 180, color: '#484f58', gap: 8,
            }}>
              <BugOutlined style={{ fontSize: 28 }} />
              <span>{logs.length === 0 ? '暂无错误或警告' : '该级别暂无日志'}</span>
            </div>
          ) : (
            displayed.map(log => (
              <LogRow
                key={log.id}
                log={log}
                expanded={expandedId === log.id}
                onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </Drawer>
    </>
  )
}

// ─── 单条日志行组件 ────────────────────────────────────────────────────────
function LogRow({ log, expanded, onToggle }: { log: LogEntry; expanded: boolean; onToggle: () => void }) {
  const hasDetail = !!(log.shortStack || log.apiError || log.fullStack)

  return (
    <div
      onClick={hasDetail ? onToggle : undefined}
      style={{
        borderBottom: '1px solid #21262d',
        padding: '7px 12px',
        cursor: hasDetail ? 'pointer' : 'default',
        background: expanded ? '#161b22' : 'transparent',
        transition: 'background 0.12s',
      }}
    >
      {/* 主行：时间 + 级别 + 消息 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
        <span style={{ color: '#484f58', flexShrink: 0, minWidth: 58, fontSize: 11 }}>{log.time}</span>

        <Tag style={{
          color: LEVEL_COLOR[log.level],
          background: LEVEL_COLOR[log.level] + '20',
          border: `1px solid ${LEVEL_COLOR[log.level]}40`,
          fontSize: 10, padding: '0 4px', flexShrink: 0, lineHeight: '16px',
        }}>
          {LEVEL_LABEL[log.level]}
        </Tag>

        {/* API 错误徽标 */}
        {log.apiError && (
          <Tag style={{
            color: '#e3b341', background: '#e3b34120', border: '1px solid #e3b34140',
            fontSize: 10, padding: '0 4px', flexShrink: 0, lineHeight: '16px',
          }}>
            {log.apiError.method} {log.apiError.status || 'NET'}
          </Tag>
        )}

        <Text style={{
          color: log.level === 'error' ? '#ffa198' : log.level === 'warn' ? '#d29922' : '#c9d1d9',
          wordBreak: 'break-all', flex: 1, fontSize: 12,
        }}>
          {log.message}
        </Text>

        {hasDetail && (
          <span style={{ color: '#484f58', fontSize: 10, flexShrink: 0, paddingTop: 2 }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </div>

      {/* 展开：API 错误详情 + 简化调用栈 */}
      {expanded && (
        <div style={{ marginTop: 6, marginLeft: 65 }}>
          {log.apiError && (
            <div style={{
              background: '#0d1117', border: '1px solid #21262d', borderRadius: 4,
              padding: '6px 10px', marginBottom: 6, fontSize: 11, color: '#8b949e',
            }}>
              <div><span style={{ color: '#e3b341' }}>URL</span>  {log.apiError.method} {log.apiError.url}</div>
              <div><span style={{ color: '#e3b341' }}>状态</span> {log.apiError.status || 'NETWORK_ERR'} {log.apiError.statusText}</div>
              {log.apiError.detail && <div><span style={{ color: '#f85149' }}>后端</span> {log.apiError.detail}</div>}
              {log.apiError.body && !log.apiError.detail && (
                <div style={{ marginTop: 4, wordBreak: 'break-all' }}>
                  <span style={{ color: '#484f58' }}>响应</span> {log.apiError.body}
                </div>
              )}
            </div>
          )}

          {log.shortStack && (
            <pre style={{
              margin: 0, color: '#6e7681', fontSize: 11,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              background: '#0d1117', padding: '5px 8px',
              borderRadius: 4, border: '1px solid #21262d',
            }}>
              {log.shortStack}
            </pre>
          )}

          {/* 完整堆栈折叠（仅在无项目帧时兜底展示） */}
          {!log.shortStack && log.fullStack && (
            <pre style={{
              margin: 0, color: '#484f58', fontSize: 10,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              background: '#0d1117', padding: '5px 8px',
              borderRadius: 4, border: '1px solid #21262d',
              maxHeight: 120, overflowY: 'auto',
            }}>
              {log.fullStack.slice(0, 600)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
