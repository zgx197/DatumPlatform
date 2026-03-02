using System;
using Datum.Core.Metrics;
using Datum.Core.Snapshot;

namespace Datum.Core.Aggregator
{
    public class EvaluationWeightConfig
    {
        // 基准属性
        public float baseline_atk     = 1000f;
        public float baseline_def     = 500f;
        public float baseline_hp      = 5000f;
        public float baseline_ehp     = 10000f;
        public float baseline_dps     = 300f;
        public float baseline_control = 5000f;

        // 权重
        public float survival_weight = 0.4f;
        public float damage_weight   = 0.4f;
        public float control_weight  = 0.2f;

        // 幂平均指数（0=几何平均）
        public float power_mean_alpha = 0f;

        // 类型加成
        public float normal_bonus = 1.0f;
        public float elite_bonus  = 1.5f;
        public float boss_bonus   = 2.5f;

        // 玩家基准（可选）
        public bool  enable_player_baseline = false;
        public float player_base_atk = 2000f;
        public float player_base_def = 800f;
        public float player_base_hp  = 10000f;
    }

    public static class ScoreAggregator
    {
        public static EntityScore Aggregate(
            CombatMetrics metrics,
            SnapshotMetadata metadata,
            EvaluationWeightConfig cfg)
        {
            // 归一化（以 baseline_ehp / baseline_dps / baseline_control 为参考）
            float ehpNorm     = cfg.baseline_ehp     > 0 ? metrics.EffectiveHP  / cfg.baseline_ehp     : 0f;
            float dpsNorm     = cfg.baseline_dps     > 0 ? metrics.DPS          / cfg.baseline_dps     : 0f;
            float controlNorm = cfg.baseline_control > 0 ? metrics.ControlScore / cfg.baseline_control : 0f;

            // 类型加成系数
            float typeBonus = metadata.FoeType switch
            {
                4 => cfg.boss_bonus,   // Boss
                5 => cfg.elite_bonus,  // Elite
                _ => cfg.normal_bonus,
            };

            float overall = PowerMean(
                new[] { ehpNorm, dpsNorm, controlNorm },
                new[] { cfg.survival_weight, cfg.damage_weight, cfg.control_weight },
                cfg.power_mean_alpha) * typeBonus;

            var score = new EntityScore
            {
                ConfigId     = metadata.ConfigId,
                Name         = metadata.Name,
                FoeType      = metadata.FoeType,
                BarriesId    = metadata.BarriesId,
                OverallScore = overall,
                EHPScore     = ehpNorm,
                DPSScore     = dpsNorm,
                ControlScore = controlNorm,

                // 分解字段
                SkillDPS                = metrics.SkillDPS,
                DotDPS                  = metrics.DotDPS,
                SkillControlScore       = metrics.SkillControlScore,
                BuffControlScore        = metrics.BuffControlScore,
                ElementResistanceFactor = metrics.ElementResistanceFactor,
                PassiveBuffModifier     = metrics.PassiveBuffModifier,
            };

            score.NormalizedValues["EHP_norm"]     = ehpNorm;
            score.NormalizedValues["DPS_norm"]     = dpsNorm;
            score.NormalizedValues["Control_norm"] = controlNorm;

            return score;
        }

        private static float PowerMean(float[] values, float[] weights, float alpha)
        {
            if (Math.Abs(alpha) < 1e-6f)
            {
                // 几何平均
                double logSum = 0;
                float wSum = 0;
                for (int i = 0; i < values.Length; i++)
                {
                    if (values[i] > 0) logSum += weights[i] * Math.Log(values[i]);
                    wSum += weights[i];
                }
                return wSum > 0 ? (float)Math.Exp(logSum / wSum) : 0f;
            }
            else
            {
                double sum = 0;
                float wSum = 0;
                for (int i = 0; i < values.Length; i++)
                {
                    sum  += weights[i] * Math.Pow(Math.Max(values[i], 0), alpha);
                    wSum += weights[i];
                }
                return wSum > 0 ? (float)Math.Pow(sum / wSum, 1.0 / alpha) : 0f;
            }
        }

        private static float CalcBaseEHP(EvaluationWeightConfig cfg)
        {
            float def = cfg.baseline_def;
            float atk = cfg.baseline_atk;
            float hp  = cfg.baseline_hp;
            float reduction = def / (def + atk);
            return hp / (1f - reduction);
        }
    }
}
