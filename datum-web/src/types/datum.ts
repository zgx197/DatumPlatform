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
  foeType: number
  barriesId: number
  hp: number
  attack: number
  defence: number
  atkSpeed: number
  toughMax: number
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
