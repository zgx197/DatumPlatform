using System;
using Datum.Core.Metrics;
using Datum.Core.Snapshot;

namespace Datum.Core.Aggregator
{
    public class EvaluationWeightConfig
    {
        public float BaselineAtk = 1000f;
        public float BaselineDef = 500f;
        public float BaselineHP  = 50000f;

        public float WeightEHP     = 0.35f;
        public float WeightDPS     = 0.40f;
        public float WeightControl = 0.25f;

        public float PowerMeanAlpha = 1f;

        public bool  EnablePlayerBaseline = false;
        public float PlayerBaseAtk = 1000f;
        public float PlayerBaseDef = 500f;
        public float PlayerBaseHP  = 10000f;
    }

    public static class ScoreAggregator
    {
        public static EntityScore Aggregate(
            CombatMetrics metrics,
            SnapshotMetadata metadata,
            EvaluationWeightConfig cfg)
        {
            // 归一化（以基准值为参考）
            float baseEHP = CalcBaseEHP(cfg);
            float baseDPS = cfg.BaselineAtk;

            float ehpNorm     = baseEHP  > 0 ? metrics.EffectiveHP  / baseEHP  : 0f;
            float dpsNorm     = baseDPS  > 0 ? metrics.DPS          / baseDPS  : 0f;
            float controlNorm = metrics.ControlScore;

            float overall = PowerMean(
                new[] { ehpNorm, dpsNorm, controlNorm },
                new[] { cfg.WeightEHP, cfg.WeightDPS, cfg.WeightControl },
                cfg.PowerMeanAlpha);

            var score = new EntityScore
            {
                ConfigId     = metadata.ConfigId,
                Name         = metadata.Name,
                FoeType      = metadata.FoeType,
                BarriesId    = metadata.BarriesId,
                OverallScore = overall * 10f,   // 映射到 0-10 量纲
                EHPScore     = ehpNorm  * 10f,
                DPSScore     = dpsNorm  * 10f,
                ControlScore = controlNorm * 10f,
            };

            score.NormalizedValues["EHP"]     = ehpNorm;
            score.NormalizedValues["DPS"]     = dpsNorm;
            score.NormalizedValues["Control"] = controlNorm;

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
            float def = cfg.BaselineDef;
            float atk = cfg.BaselineAtk;
            float hp  = cfg.BaselineHP;
            float reduction = def / (def + atk);
            return hp / (1f - reduction);
        }
    }
}
