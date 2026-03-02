// AI Function Calling 工具定义 + 执行器
import { datumApi } from '../api/datum'

// OpenAI 兼容的 Tool 定义格式（Kimi 完全兼容）
export const TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_all_scores',
      description: '获取所有怪物的综合评分列表，包含 configId、名称、类型、关卡、综合评分、EHP/DPS/Control 分项评分。可用于分析怪物强度分布、找出最强/最弱怪物、对比不同类型怪物等。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weight_config',
      description: '获取当前权重配置，包含 baseline（基准值）和 weight（权重）参数。可用于解释当前评分计算方式、分析权重是否合理等。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_difficulty_tiers',
      description: '获取难度档位摘要：包含自动计算的阈值（easy/medium/hard）和每只怪物的 tier 标签（easy/medium/hard/boss）。可用于分析难度分布、推荐怪物搭配等。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_level_metrics',
      description: '获取所有关卡的难度分析指标，包含峰值难度、平均难度、波次数量、怪物数量、难度方差等。可用于比较不同关卡难度、找出难度异常的关卡。',
      parameters: {
        type: 'object',
        properties: {
          lifetime: {
            type: 'number',
            description: '怪物预计存活时间（秒），默认30秒。调小会降低同时在场怪物数从而降低难度值。',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_level_detail',
      description: '获取指定关卡的详细难度分析，包含波次详情（每波怪物组成、波次难度）和难度曲线数据点。可用于深入分析某个关卡的难度节奏。',
      parameters: {
        type: 'object',
        properties: {
          levelId: {
            type: 'number',
            description: '关卡 ID（barriesId）',
          },
        },
        required: ['levelId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_calibration_samples',
      description: '获取当前校准样本列表，包含每条样本的怪物名称、主观评分（1-10）和归一化的 EHP/DPS/Control 值。可用于分析校准数据质量、建议补充样本等。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_templates',
      description: '获取怪物模板列表，模板是按 (ModelId, FoeType, AttackSkillIds) 聚类的怪物组。可用于分析模板一致性、发现属性缩放异常。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'detect_anomalies',
      description: '检测当前所有怪物中的异常情况，返回有问题的怪物及其异常描述（如 DPS为0、EHP/DPS 失衡超过10倍、控制满值等）。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_score_statistics',
      description: '获取评分的统计摘要：总数、平均值、中位数、标准差、最大/最小值、各类型怪物的平均评分等。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_monster',
      description: '按名称或 configId 搜索怪物，返回匹配怪物的详细评分信息（含 DPS 分解、EHP 修正因子、控制分解等）。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词（怪物名称或 configId）',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_monsters',
      description: '对比两只或多只怪物的详细评分，返回对比表格数据。',
      parameters: {
        type: 'object',
        properties: {
          configIds: {
            type: 'array',
            items: { type: 'number' },
            description: '要对比的怪物 configId 列表',
          },
        },
        required: ['configIds'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_system_info',
      description: '获取 Datum 系统的基本信息：版本号、数据目录、怪物总数、关卡数等。',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

// Tool 执行器：调用后端 API 获取真实数据
export async function executeTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'get_all_scores': {
        const scores = await datumApi.scores()
        // 只返回关键字段，减少 token
        const summary = scores.map(s => ({
          id: s.configId, name: s.name, type: s.foeType, level: s.barriesId,
          overall: +s.overallScore.toFixed(3),
          ehp: +s.ehpScore.toFixed(3), dps: +s.dpsScore.toFixed(3), ctrl: +s.controlScore.toFixed(4),
        }))
        return JSON.stringify({ count: summary.length, monsters: summary })
      }

      case 'get_weight_config': {
        const w = await datumApi.weights()
        return JSON.stringify(w)
      }

      case 'get_difficulty_tiers': {
        const tiers = await datumApi.difficultyTiers()
        return JSON.stringify(tiers)
      }

      case 'get_level_metrics': {
        const metrics = await datumApi.levelMetrics(args.lifetime)
        const summary = metrics.map(m => ({
          levelId: m.levelId, peak: +m.peakSimultaneousDifficulty.toFixed(2), avg: +m.averageDifficultyDensity.toFixed(2),
          waves: m.waveCount, monsters: m.totalMonsterCount, variance: +m.difficultyElasticity.toFixed(2),
        }))
        return JSON.stringify({ count: summary.length, levels: summary })
      }

      case 'get_level_detail': {
        const m = await datumApi.levelMetricsById(args.levelId)
        return JSON.stringify({
          levelId: m.levelId,
          peak: m.peakSimultaneousDifficulty, avg: m.averageDifficultyDensity, waves: m.waveCount, monsters: m.totalMonsterCount,
          waveDetails: m.waveDetails?.map(w => ({
            region: w.regionId, trigger: w.triggerId, wave: w.waveIndex,
            delay: w.delaySeconds, count: w.monsterCount, difficulty: +w.waveDifficulty.toFixed(3),
            monsters: w.monsters,
          })),
        })
      }

      case 'get_calibration_samples': {
        const samples = await datumApi.calibrationSamples()
        return JSON.stringify({ count: samples.length, samples })
      }

      case 'get_templates': {
        const templates = await datumApi.templates()
        const summary = templates.map(t => ({
          clusterKey: t.clusterKey, foeType: t.foeType, variantCount: t.variants?.length ?? 0,
          baseValues: t.baseValues,
        }))
        return JSON.stringify({ count: summary.length, templates: summary })
      }

      case 'detect_anomalies': {
        const scores = await datumApi.scores()
        const anomalies: { configId: number; name: string; issues: string[] }[] = []
        for (const s of scores) {
          const issues: string[] = []
          if (s.ehpScore > 0 && s.dpsScore > 0 && s.ehpScore / s.dpsScore > 10)
            issues.push(`生存远大于输出（EHP ${s.ehpScore.toFixed(1)} vs DPS ${s.dpsScore.toFixed(1)}）`)
          if (s.ehpScore > 0 && s.dpsScore > 0 && s.dpsScore / s.ehpScore > 10)
            issues.push(`输出远大于生存（DPS ${s.dpsScore.toFixed(1)} vs EHP ${s.ehpScore.toFixed(1)}）`)
          if (s.controlScore >= 1.0) issues.push(`控制评分满值（${(s.controlScore * 100).toFixed(0)}%）`)
          if (s.dpsScore === 0) issues.push('DPS 为 0（可能缺少技能蓝图数据）')
          if (issues.length > 0) anomalies.push({ configId: s.configId, name: s.name, issues })
        }
        return JSON.stringify({ anomalyCount: anomalies.length, total: scores.length, anomalies })
      }

      case 'get_score_statistics': {
        const scores = await datumApi.scores()
        const vals = scores.map(s => s.overallScore).sort((a, b) => a - b)
        const sum = vals.reduce((a, b) => a + b, 0)
        const avg = sum / vals.length
        const median = vals[Math.floor(vals.length / 2)]
        const variance = vals.reduce((a, v) => a + (v - avg) ** 2, 0) / vals.length
        const std = Math.sqrt(variance)
        // 按类型统计
        const byType: Record<number, { count: number; avgScore: number }> = {}
        for (const s of scores) {
          if (!byType[s.foeType]) byType[s.foeType] = { count: 0, avgScore: 0 }
          byType[s.foeType].count++
          byType[s.foeType].avgScore += s.overallScore
        }
        for (const t of Object.values(byType)) t.avgScore = +(t.avgScore / t.count).toFixed(3)
        return JSON.stringify({
          total: vals.length, avg: +avg.toFixed(3), median: +median.toFixed(3),
          std: +std.toFixed(3), min: +vals[0].toFixed(3), max: +vals[vals.length - 1].toFixed(3),
          byFoeType: byType,
        })
      }

      case 'search_monster': {
        const scores = await datumApi.scores()
        const q = String(args.query).toLowerCase()
        const matched = scores.filter(s =>
          s.name.toLowerCase().includes(q) || String(s.configId).includes(q)
        ).slice(0, 10)
        return JSON.stringify({ matchCount: matched.length, monsters: matched })
      }

      case 'compare_monsters': {
        const scores = await datumApi.scores()
        const ids = new Set(args.configIds as number[])
        const matched = scores.filter(s => ids.has(s.configId))
        return JSON.stringify({ monsters: matched })
      }

      case 'get_system_info': {
        const health = await datumApi.health()
        return JSON.stringify(health)
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` })
    }
  } catch (err: any) {
    return JSON.stringify({ error: err?.message ?? 'Tool execution failed' })
  }
}
