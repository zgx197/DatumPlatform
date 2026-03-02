using Datum.Core.BuffEvaluator;
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
            SkillEvaluationResult skillResult,
            BuffEvaluationResult buffResult = null)
        {
            float skillDPS = skillResult?.EffectiveDPS ?? resolved.FinalAtk;
            float dotDPS = buffResult?.DotDPS ?? 0f;
            float totalDPS = skillDPS + dotDPS;

            float skillControl = skillResult?.ControlScore ?? 0f;
            float buffControl = buffResult?.ControlDurationSec ?? 0f;
            float totalControl = skillControl + buffControl;

            // 元素抗性修正因子：1 + avg(IceRes, FireRes, PoisonRes, EleRes) / 10000
            float avgRes = (resolved.IceRes + resolved.FireRes + resolved.PoisonRes + resolved.EleRes) / 4f;
            float elementFactor = 1f + avgRes / 10000f;

            // 被动 Buff 修正因子
            float passiveModifier = buffResult?.PassiveEHPModifier ?? 1f;

            float baseEHP = CalcEHP(resolved.FinalHP, resolved.FinalDef, baselineAtk);
            float effectiveHP = baseEHP * elementFactor * passiveModifier;

            float toughDPS = resolved.ToughMax > 0 ? totalDPS / resolved.ToughMax : 0f;

            return new CombatMetrics
            {
                EffectiveHP             = effectiveHP,
                DPS                     = totalDPS,
                ControlScore            = totalControl,
                ToughnessDPS            = toughDPS,
                SkillDPS                = skillDPS,
                DotDPS                  = dotDPS,
                SkillControlScore       = skillControl,
                BuffControlScore        = buffControl,
                ElementResistanceFactor = elementFactor,
                PassiveBuffModifier     = passiveModifier,
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
