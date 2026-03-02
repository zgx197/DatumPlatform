export interface EntityScore {
  configId: number
  name: string
  foeType: number
  barriesId: number
  overallScore: number
  ehpScore: number
  dpsScore: number
  controlScore: number
  normalizedValues: { EHP_norm: number; DPS_norm: number; Control_norm: number }

  // DPS 分解（原始值）
  skillDPS: number
  dotDPS: number

  // Control 分解（原始值）
  skillControlScore: number
  buffControlScore: number

  // EHP 修正因子
  elementResistanceFactor: number
  passiveBuffModifier: number
}

export interface WeightConfig {
  baseline_atk: number
  baseline_def: number
  baseline_hp: number
  baseline_ehp: number
  baseline_dps: number
  baseline_control: number
  survival_weight: number
  damage_weight: number
  control_weight: number
  power_mean_alpha: number
  normal_bonus: number
  elite_bonus: number
  boss_bonus: number
  enable_player_baseline: boolean
  player_base_atk: number
  player_base_def: number
  player_base_hp: number
}

export interface TemplateVariant {
  configId: number
  name: string
  rawValues: number[]
  scales: number[]
  score: number
}

export interface MonsterTemplate {
  clusterKey: string
  foeType: number
  sortedSkillIds: number[]
  baseValues: number[]
  variants: TemplateVariant[]
  hasConsistencyIssue: boolean
}

export interface DatumFoeRow {
  configId: number
  name: string
  level: number
  foeType: number
  modelId: number
  barriesId: number
  hp: number
  attack: number
  defence: number
  toughMax: number
  speed: number
  attackSpeedPro: number
  iceRes: number
  fireRes: number
  poisonRes: number
  eleRes: number
  norAttackSkillId: number
  attackSkillIds: number[]
  passiveSkillIds: number[]
}

export interface HealthInfo {
  status: string
  version: string
  monsterCount: number
  scoreCount: number
  dataDir: string
  serverTime: string
}

export interface CalibrationSample {
  configId: number
  name: string
  subjectiveScore: number
  ehpNorm: number
  dpsNorm: number
  controlNorm: number
}

export const FOE_TYPE_LABELS: Record<number, string> = {
  0: '未知',
  1: '杂兵',
  2: '远程',
  3: '特殊',
  4: 'Boss',
  5: '精英',
  6: '特殊',
  9: '靶子',
}

export const FOE_TYPE_COLORS: Record<number, string> = {
  0: 'default',
  1: 'blue',
  2: 'cyan',
  3: 'orange',
  4: 'red',
  5: 'green',
}

// 元素类型（ControlElementAttrResType 枚举）
export const ELEMENT_LABELS: Record<number, string> = {
  0: '物理',
  1: '冰',
  2: '火',
  3: '毒',
  4: '电',
}

export const ELEMENT_COLORS: Record<number, string> = {
  0: '#aaa',
  1: '#61dafb',
  2: '#ff6b35',
  3: '#a855f7',
  4: '#facc15',
}

// ─── 关卡结构 ──────────────────────────────────────

export interface LevelStructure {
  levelId: number
  levelName: string
  exportTime: string
  frameRate: number
  triggers: TriggerData[]
  presetMonsters: PresetMonsterData[]
}

export interface TriggerData {
  triggerId: number
  regionId: number
  barriesId: number
  position: { x: number; y: number; z: number }
  behaviorType: number
  healthCoefficient: number
  waves: WaveData[]
  timeline: TimelineFrame[]
}

export interface WaveData {
  waveIndex: number
  delayMs: number
  monsters: MonsterInWave[]
}

export interface MonsterInWave {
  configId: number
  count: number
}

export interface TimelineFrame {
  frame: number
  monsterIds: string[]
}

export interface PresetMonsterData {
  triggerId: number
  monsterIds: string[]
  positions: { x: number; y: number; z: number }[]
  rotations: { x: number; y: number; z: number }[]
}

// ─── 关卡指标 ──────────────────────────────────────

export interface LevelMetrics {
  levelId: number
  levelName: string
  totalMonsterCount: number
  waveCount: number
  totalDifficulty: number
  peakSimultaneousDifficulty: number
  averageDifficultyDensity: number
  durationSeconds: number
  difficultyCurve: DifficultyPoint[]
  acceleratedCurve: DifficultyPoint[]
  difficultyElasticity: number
  monsterTypeDistribution: Record<string, number>
  elementDistribution: Record<string, number>
  waveDetails: WaveMetricsItem[]
}

export interface DifficultyPoint {
  timeSeconds: number
  difficulty: number
  aliveCount: number
}

export interface WaveMetricsItem {
  triggerId: number
  regionId: number
  waveIndex: number
  delaySeconds: number
  monsterCount: number
  waveDifficulty: number
  monsters: MonsterInWave[]
}

export type DifficultyTier = 'easy' | 'medium' | 'hard' | 'boss'

export interface DifficultyThresholds {
  easy: number
  medium: number
  hard: number
}

export interface MonsterTierEntry {
  configId: number
  name: string
  foeType: number
  score: number
  ehpScore: number
  dpsScore: number
  barriesId: number
  tier: DifficultyTier
}

export interface DifficultyTiersSummary {
  generatedAt: string
  thresholds: DifficultyThresholds
  monsters: MonsterTierEntry[]
}
