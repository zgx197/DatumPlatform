// Prompt 规则管理：预定义 + 自定义规则，控制 AI 输出格式和行为

export interface PromptRule {
  id: string
  label: string
  description: string
  /** 注入到 system prompt 的指令片段 */
  prompt: string
  /** 是否为内置规则（内置规则不可删除） */
  builtin: boolean
  /** 是否启用 */
  enabled: boolean
}

// ─── 内置规则定义 ───
export const BUILTIN_RULES: Omit<PromptRule, 'enabled'>[] = [
  {
    id: 'latex-formula',
    label: 'LaTeX 公式',
    description: '所有数学公式必须使用 LaTeX 语法（行内 $...$ 或独立 $$...$$），禁止使用纯文本或代码块显示公式',
    prompt: `所有数学公式必须严格使用 LaTeX 语法，并且必须用 $ 或 $$ 符号包裹：
- 行内公式用 $...$ 包裹，例如：$EHP = HP \\times DefFactor$
- 独立公式用 $$...$$ 包裹，例如：$$OverallScore = \\frac{w_1 \\cdot EHP + w_2 \\cdot DPS}{w_1 + w_2 + w_3}$$
- 禁止写裸露的 LaTeX 命令（如 \\text{...} \\frac{...}），必须用 $ 包裹
- 错误示例（禁止）：\\text{DPS} = \\frac{伤害}{时间}
- 正确示例（必须）：$\\text{DPS} = \\frac{\\text{伤害}}{\\text{时间}}$
- 禁止用代码块或反引号来展示公式`,
    builtin: true,
  },
  {
    id: 'mermaid-diagram',
    label: 'Mermaid 流程图',
    description: '所有流程图、架构图、时序图等必须使用 Mermaid 语法（```mermaid 代码块）',
    prompt: '当需要展示流程图、架构图、状态图、时序图等图表时，必须使用 Mermaid 语法，放在 ```mermaid 代码块中。不要用纯文本的箭头或 ASCII art 来画图。',
    builtin: true,
  },
  {
    id: 'table-format',
    label: '表格格式化',
    description: '数据对比和列表展示优先使用 Markdown 表格，保持结构清晰',
    prompt: '当展示多个实体的属性对比、数据列表或统计结果时，优先使用 Markdown 表格格式。表格应包含清晰的列标题，数值保留合理的小数位数（通常 2-3 位）。',
    builtin: true,
  },
  {
    id: 'chinese-response',
    label: '中文回复',
    description: '所有回复内容使用中文，技术术语可保留英文并附中文解释',
    prompt: '请用中文回复所有内容。技术术语（如 EHP、DPS、Control）可以保留英文缩写，但首次出现时应提供中文解释。',
    builtin: true,
  },
  {
    id: 'data-driven',
    label: '数据驱动',
    description: '回答必须基于实际数据，需要时主动调用工具获取，禁止编造数据',
    prompt: '回答问题时必须基于实际数据。如果需要具体的评分、权重、关卡数据等信息，必须先调用对应的工具函数获取真实数据，绝对不要凭空编造或估算数据。如果工具调用失败，应明确告知用户数据获取失败。',
    builtin: true,
  },
  {
    id: 'step-analysis',
    label: '分步分析',
    description: '复杂问题分步骤解答，每步有小标题和具体数据',
    prompt: '对于复杂的分析问题，请分步骤解答：1) 先明确分析目标 2) 获取所需数据 3) 逐步分析并展示中间结果 4) 给出结论和建议。每个步骤用小标题标记。',
    builtin: true,
  },
  {
    id: 'anomaly-highlight',
    label: '异常高亮',
    description: '发现异常数据时主动标注并给出修复建议',
    prompt: '在分析数据时，如果发现异常值（如 DPS 为 0、评分极端偏离、属性缺失等），请主动用 **⚠️ 异常** 标记高亮，并给出可能的原因分析和修复建议。',
    builtin: true,
  },
  {
    id: 'concise-mode',
    label: '简洁模式',
    description: '回复尽量精炼，避免冗余解释，直击要点',
    prompt: '回复应尽量精炼直接，避免冗余的开场白和重复解释。优先用数据和表格说话，减少大段文字描述。如果用户没有追问，不需要主动展开所有细节。',
    builtin: true,
  },
]

const STORAGE_KEY = 'datum-prompt-rules'

/** 获取所有规则（内置 + 自定义），合并启用状态 */
export function getAllRules(): PromptRule[] {
  const stored = loadStored()

  // 内置规则：合并存储的启用状态
  const builtinRules: PromptRule[] = BUILTIN_RULES.map(r => ({
    ...r,
    enabled: stored.enabledMap[r.id] ?? true, // 内置规则默认启用
  }))

  // 自定义规则
  const customRules: PromptRule[] = (stored.customRules || []).map(r => ({
    ...r,
    builtin: false,
    enabled: stored.enabledMap[r.id] ?? true,
  }))

  return [...builtinRules, ...customRules]
}

/** 获取所有启用规则的 prompt 片段，拼接为 system prompt 的附加部分 */
export function getEnabledRulesPrompt(): string {
  const rules = getAllRules().filter(r => r.enabled)
  if (rules.length === 0) return ''

  const lines = ['', '## 输出格式规则（必须严格遵守）']
  rules.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.prompt}`)
  })
  return lines.join('\n')
}

/** 切换某条规则的启用状态 */
export function toggleRule(id: string, enabled: boolean) {
  const stored = loadStored()
  stored.enabledMap[id] = enabled
  saveStored(stored)
}

/** 添加自定义规则 */
export function addCustomRule(label: string, description: string, prompt: string): PromptRule {
  const stored = loadStored()
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const rule: Omit<PromptRule, 'enabled'> = { id, label, description, prompt, builtin: false }
  stored.customRules.push(rule)
  stored.enabledMap[id] = true
  saveStored(stored)
  return { ...rule, enabled: true }
}

/** 删除自定义规则 */
export function removeCustomRule(id: string) {
  const stored = loadStored()
  stored.customRules = stored.customRules.filter(r => r.id !== id)
  delete stored.enabledMap[id]
  saveStored(stored)
}

// ─── 持久化 ───

interface StoredData {
  enabledMap: Record<string, boolean>
  customRules: Omit<PromptRule, 'enabled'>[]
}

function loadStored(): StoredData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        enabledMap: parsed.enabledMap || {},
        customRules: parsed.customRules || [],
      }
    }
  } catch {}
  return { enabledMap: {}, customRules: [] }
}

function saveStored(data: StoredData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
