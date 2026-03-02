// AI 模型配置管理（存储在 localStorage）

export interface AiModelConfig {
  id: string
  name: string
  provider: 'kimi' | 'openai' | 'deepseek' | 'custom'
  apiKey: string
  baseUrl: string
  model: string
}

const STORAGE_KEY = 'datum-ai-models'
const ACTIVE_KEY = 'datum-ai-active-model'

const DEFAULT_PROVIDERS: Record<string, { baseUrl: string; model: string }> = {
  kimi:     { baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  openai:   { baseUrl: 'https://api.openai.com/v1',  model: 'gpt-4o-mini' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  custom:   { baseUrl: '',                             model: '' },
}

export function getModels(): AiModelConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveModels(models: AiModelConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(models))
}

export function getActiveModelId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function setActiveModelId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id)
}

export function getActiveModel(): AiModelConfig | null {
  const models = getModels()
  const activeId = getActiveModelId()
  if (activeId) {
    const found = models.find(m => m.id === activeId)
    if (found) return found
  }
  return models.length > 0 ? models[0] : null
}

export function createDefaultModel(provider: AiModelConfig['provider'], apiKey: string, name?: string): AiModelConfig {
  const defaults = DEFAULT_PROVIDERS[provider] ?? DEFAULT_PROVIDERS.custom
  return {
    id: `${provider}-${Date.now()}`,
    name: name || provider.charAt(0).toUpperCase() + provider.slice(1),
    provider,
    apiKey,
    baseUrl: defaults.baseUrl,
    model: defaults.model,
  }
}

export { DEFAULT_PROVIDERS }
