// 全局 UI 偏好管理：字体大小、行距等显示设置，存储在 localStorage

export interface UiPrefs {
  /** AI 聊天气泡内字体大小（px），默认 13 */
  chatFontSize: number
  /** 全局内容区字体大小缩放比例（0.85 ~ 1.2），默认 1.0 */
  contentScale: number
}

const STORAGE_KEY = 'datum-ui-prefs'

const DEFAULTS: UiPrefs = {
  chatFontSize: 13,
  contentScale: 1.0,
}

export const CHAT_FONT_SIZES = [11, 12, 13, 14, 15, 16] as const
export const CONTENT_SCALES = [
  { label: '80%',  value: 0.80 },
  { label: '90%',  value: 0.90 },
  { label: '100%', value: 1.00 },
  { label: '110%', value: 1.10 },
  { label: '120%', value: 1.20 },
] as const

export function getUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULTS, ...parsed }
    }
  } catch {}
  return { ...DEFAULTS }
}

export function saveUiPrefs(prefs: Partial<UiPrefs>) {
  const current = getUiPrefs()
  const updated = { ...current, ...prefs }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  // 触发全局事件，让监听者响应
  window.dispatchEvent(new CustomEvent('datum-ui-prefs-change', { detail: updated }))
  return updated
}

export function useChatFontSize(): [number, (size: number) => void] {
  return [
    getUiPrefs().chatFontSize,
    (size: number) => saveUiPrefs({ chatFontSize: size }),
  ]
}
