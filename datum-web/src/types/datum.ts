export interface EntityScore {
  configId: number
  name: string
  foeType: number
  barriesId: number
  overallScore: number
  ehpScore: number
  dpsScore: number
  controlScore: number
  normalizedValues: { EHP: number; DPS: number; Control: number }
}

export interface WeightConfig {
  baselineAtk: number
  baselineDef: number
  baselineHP: number
  weightEHP: number
  weightDPS: number
  weightControl: number
  powerMeanAlpha: number
  enablePlayerBaseline: boolean
  playerBaseAtk: number
  playerBaseDef: number
  playerBaseHP: number
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
  1: '近战',
  2: '远程',
  3: '精英',
  4: 'Boss',
  5: '杂兵',
}

export const FOE_TYPE_COLORS: Record<number, string> = {
  0: 'default',
  1: 'blue',
  2: 'cyan',
  3: 'orange',
  4: 'red',
  5: 'green',
}
