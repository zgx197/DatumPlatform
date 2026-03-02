// AI 聊天服务：直连 Kimi/OpenAI 兼容 API，支持 Function Calling + 流式输出
import type { AiModelConfig } from './aiConfig'
import { TOOL_DEFINITIONS, executeTool } from './aiTools'
import { getEnabledRulesPrompt } from './promptRules'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
  // 前端展示用
  _toolName?: string
  _toolResult?: string
  _loading?: boolean
}

interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

const BASE_SYSTEM_PROMPT = `你是 Datum 评分系统的 AI 助手，专门帮助用户理解和分析怪物难度评分数据。

## 你的能力
- 查询当前所有怪物的评分数据、权重配置、难度档位
- 分析关卡难度曲线和波次组成
- 检测异常怪物（DPS为0、属性失衡等）
- 搜索和对比特定怪物
- 解释评分系统的计算公式和设计原理

## 评分系统简介
Datum 评分系统将怪物属性转换为三个归一化维度：
- **EHP**（等效生命值）= HP × 防御系数 × 元素抗性 × 被动Buff
- **DPS**（每秒伤害）= 技能DPS + DOT DPS
- **Control**（控制能力）= 技能控制覆盖率 + Buff控制时长

综合评分 = 加权几何平均(EHP_norm, DPS_norm, Control_norm) × 类型系数`

/** 构建完整 system prompt：基础 + 启用的 Prompt 规则 */
function buildSystemPrompt(): string {
  return BASE_SYSTEM_PROMPT + getEnabledRulesPrompt()
}

// 流式聊天：发送消息，返回逐步更新的回调
export async function streamChat(
  model: AiModelConfig,
  messages: ChatMessage[],
  onUpdate: (content: string, done: boolean) => void,
  onToolCall?: (toolName: string, args: string) => void,
): Promise<ChatMessage[]> {
  const apiMessages = [
    { role: 'system', content: buildSystemPrompt() },
    ...messages.filter(m => m.role !== 'system').map(m => {
      if (m.role === 'tool') {
        return { role: m.role, content: m.content, tool_call_id: m.tool_call_id }
      }
      if (m.tool_calls) {
        return { role: m.role, content: m.content || '', tool_calls: m.tool_calls }
      }
      return { role: m.role, content: m.content }
    }),
  ]

  const body = {
    model: model.model,
    messages: apiMessages,
    tools: TOOL_DEFINITIONS,
    stream: true,
    temperature: 0.7,
  }

  const response = await fetch(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(`API 请求失败 (${response.status}): ${errText.slice(0, 200)}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法获取响应流')

  const decoder = new TextDecoder()
  let fullContent = ''
  let toolCalls: ToolCall[] = []
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const json = JSON.parse(trimmed.slice(6))
        const delta = json.choices?.[0]?.delta
        if (!delta) continue

        // 文本内容
        if (delta.content) {
          fullContent += delta.content
          onUpdate(fullContent, false)
        }

        // Tool calls（增量拼接）
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
            }
            if (tc.id) toolCalls[idx].id = tc.id
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments
          }
        }
      } catch {}
    }
  }

  // 如果有 tool calls，执行它们并递归
  if (toolCalls.length > 0) {
    onUpdate(fullContent || '正在查询数据...', false)

    const assistantMsg: ChatMessage = {
      role: 'assistant',
      content: fullContent || '',
      tool_calls: toolCalls,
    }

    const newMessages = [...messages, assistantMsg]

    // 依次执行每个 tool call
    for (const tc of toolCalls) {
      const fnName = tc.function.name
      let fnArgs: Record<string, any> = {}
      try { fnArgs = JSON.parse(tc.function.arguments || '{}') } catch {}

      onToolCall?.(fnName, JSON.stringify(fnArgs))

      const result = await executeTool(fnName, fnArgs)

      newMessages.push({
        role: 'tool',
        content: result,
        tool_call_id: tc.id,
        _toolName: fnName,
        _toolResult: result,
      })
    }

    // 带 tool 结果递归调用（非流式也可以，这里继续流式）
    return streamChat(model, newMessages, onUpdate, onToolCall)
  }

  onUpdate(fullContent, true)
  return [...messages, { role: 'assistant', content: fullContent }]
}
