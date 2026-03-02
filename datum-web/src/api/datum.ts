import { api } from './client'
import type {
  EntityScore,
  WeightConfig,
  MonsterTemplate,
  DatumFoeRow,
  HealthInfo,
  CalibrationSample,
  LevelStructure,
  LevelMetrics,
  DifficultyTiersSummary,
} from '../types/datum'

export const datumApi = {
  health: (): Promise<HealthInfo> =>
    api.get('/health').then(r => r.data),

  scores: (params?: { foeType?: number; barriesId?: number; sort?: string; desc?: boolean }): Promise<EntityScore[]> =>
    api.get('/scores', { params }).then(r => r.data),

  recalcScores: (weights: WeightConfig): Promise<EntityScore[]> =>
    api.post('/scores/recalc', weights).then(r => r.data),

  monsters: (): Promise<DatumFoeRow[]> =>
    api.get('/monsters').then(r => r.data),

  weights: (): Promise<WeightConfig> =>
    api.get('/weights').then(r => r.data),

  updateWeights: (weights: WeightConfig): Promise<void> =>
    api.put('/weights', weights).then(r => r.data),

  templates: (): Promise<MonsterTemplate[]> =>
    api.get('/templates').then(r => r.data),

  calibrationSamples: (): Promise<CalibrationSample[]> =>
    api.get('/calibration/samples').then(r => r.data),

  saveCalibrationSamples: (samples: CalibrationSample[]): Promise<void> =>
    api.put('/calibration/samples', samples).then(r => r.data),

  runCalibration: (): Promise<{
    survival_weight: number; damage_weight: number; control_weight: number
    scaleFactor: number; rSquared: number; mse: number; interpretation: string
  }> =>
    api.post('/calibration/run').then(r => r.data),

  levelStructures: (): Promise<LevelStructure[]> =>
    api.get('/levels/structures').then(r => r.data),

  levelMetrics: (lifetime?: number): Promise<LevelMetrics[]> =>
    api.get('/levels/metrics', { params: lifetime != null ? { lifetime } : undefined }).then(r => r.data),

  levelMetricsById: (levelId: number, lifetime?: number): Promise<LevelMetrics> =>
    api.get(`/levels/metrics/${levelId}`, { params: lifetime != null ? { lifetime } : undefined }).then(r => r.data),

  difficultyTiers: (): Promise<DifficultyTiersSummary> =>
    api.get('/difficulty-tiers').then(r => r.data),
}
