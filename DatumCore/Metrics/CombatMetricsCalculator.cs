using Datum.Core.Resolver;
using Datum.Core.SkillEvaluator;

namespace Datum.Core.Metrics
{
    public static class CombatMetricsCalculator
    {
        public static CombatMetrics Calculate(
            ResolvedAttributeSnapshot resolved,
            float baselineAtk,
            float baselineDef,
            SkillEvaluationResult skillResult)
        {
            float effectiveHP = CalcEHP(resolved.FinalHP, resolved.FinalDef, baselineAtk);
            float dps = skillResult?.EffectiveDPS ?? resolved.FinalAtk;
            float control = skillResult?.ControlScore ?? 0f;
            float toughDPS = resolved.ToughMax > 0 ? dps / resolved.ToughMax : 0f;

            return new CombatMetrics
            {
                EffectiveHP  = effectiveHP,
                DPS          = dps,
                ControlScore = control,
                ToughnessDPS = toughDPS,
            };
        }

        private static float CalcEHP(float hp, float def, float baselineAtk)
        {
            if (hp <= 0) return 0f;
            float damageReduction = def / (def + baselineAtk);
            return hp / (1f - damageReduction);
        }
    }
}
