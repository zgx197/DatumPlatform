// 全局快捷键管理：定义、注册、自定义覆盖

export interface ShortcutDef {
  id: string
  label: string
  description: string
  defaultKeys: string   // 例如 'Ctrl+Shift+A'
  action: string        // 对应的回调 action 名
}

// 系统内置快捷键定义
export const BUILTIN_SHORTCUTS: ShortcutDef[] = [
  {
    id: 'toggle-ai-chat',
    label: 'AI 助手',
    description: '打开/关闭 AI 聊天抽屉',
    defaultKeys: 'Ctrl+Shift+A',
    action: 'toggle-ai-chat',
  },
  {
    id: 'toggle-debug-panel',
    label: '调试面板',
    description: '打开/关闭调试信息面板',
    defaultKeys: 'Ctrl+Shift+D',
    action: 'toggle-debug-panel',
  },
  {
    id: 'go-dashboard',
    label: '评分看板',
    description: '跳转到评分看板页面',
    defaultKeys: 'Ctrl+1',
    action: 'go-dashboard',
  },
  {
    id: 'go-templates',
    label: '模板分析',
    description: '跳转到模板分析页面',
    defaultKeys: 'Ctrl+2',
    action: 'go-templates',
  },
  {
    id: 'go-levels',
    label: '关卡视图',
    description: '跳转到关卡视图页面',
    defaultKeys: 'Ctrl+3',
    action: 'go-levels',
  },
  {
    id: 'go-calibration',
    label: '权重调节',
    description: '跳转到权重调节页面',
    defaultKeys: 'Ctrl+4',
    action: 'go-calibration',
  },
  {
    id: 'go-settings',
    label: '设置',
    description: '跳转到设置页面',
    defaultKeys: 'Ctrl+,',
    action: 'go-settings',
  },
]

const STORAGE_KEY = 'datum-shortcut-overrides'

/** 获取自定义覆盖映射 { shortcutId: customKeys } */
export function getOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

export function saveOverrides(overrides: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
}

/** 获取某个快捷键当前生效的按键组合 */
export function getEffectiveKeys(id: string): string {
  const overrides = getOverrides()
  const def = BUILTIN_SHORTCUTS.find(s => s.id === id)
  return overrides[id] || def?.defaultKeys || ''
}

/** 获取所有快捷键及当前按键 */
export function getAllShortcuts(): (ShortcutDef & { currentKeys: string; isCustom: boolean })[] {
  const overrides = getOverrides()
  return BUILTIN_SHORTCUTS.map(s => ({
    ...s,
    currentKeys: overrides[s.id] || s.defaultKeys,
    isCustom: !!overrides[s.id],
  }))
}

/** 将按键字符串解析为 KeyboardEvent 的匹配条件 */
export function parseKeys(keys: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } | null {
  if (!keys) return null
  const parts = keys.split('+').map(p => p.trim().toLowerCase())
  return {
    ctrl: parts.includes('ctrl') || parts.includes('cmd'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key: parts.filter(p => !['ctrl', 'cmd', 'shift', 'alt'].includes(p))[0] || '',
  }
}

/** 判断一个 KeyboardEvent 是否匹配某个按键字符串 */
export function matchEvent(e: KeyboardEvent, keys: string): boolean {
  const parsed = parseKeys(keys)
  if (!parsed) return false
  const ctrlMatch = parsed.ctrl === (e.ctrlKey || e.metaKey)
  const shiftMatch = parsed.shift === e.shiftKey
  const altMatch = parsed.alt === e.altKey
  const keyMatch = e.key.toLowerCase() === parsed.key
  return ctrlMatch && shiftMatch && altMatch && keyMatch
}

/** 将 KeyboardEvent 格式化为可读的按键字符串（用于自定义录入） */
export function eventToKeyString(e: KeyboardEvent): string | null {
  // 排除纯修饰键
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')
  // 特殊键名映射
  const keyName = e.key.length === 1 ? e.key.toUpperCase() : e.key
  parts.push(keyName)
  // 至少要有一个修饰键
  if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) return null
  return parts.join('+')
}
