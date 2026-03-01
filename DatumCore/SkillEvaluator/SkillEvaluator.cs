using System.Collections.Generic;
using Datum.Core.Provider;

namespace Datum.Core.SkillEvaluator
{
    /// <summary>
    /// 技能评估器：基于技能蓝图计算 DPS 和控制评分。
    /// 帧率固定为 10fps（FrameSyncEngine 标准）。
    /// </summary>
    public static class SkillEvaluator
    {
        private const float FPS = 10f;
        private const float DamageRatioScale = 10000f;

        public static SkillEvaluationResult Evaluate(
            IReadOnlyList<int> attackSkillIds,
            int norAttackSkillId,
            float baseAttack,
            IFoeDataProvider provider)
        {
            float totalDamageRatio = 0f;
            float controlCoverage = 0f;

            // 累计所有攻击技能的打击点
            var allSkillIds = new List<int>(attackSkillIds ?? new List<int>());
            if (norAttackSkillId > 0 && !allSkillIds.Contains(norAttackSkillId))
                allSkillIds.Add(norAttackSkillId);

            foreach (var skillId in allSkillIds)
            {
                var blueprint = provider.GetSkillBlueprint(skillId);
                var info      = provider.GetSkillInfoRow(skillId);
                if (blueprint == null) continue;

                float skillDamageRatio = 0f;
                float skillFrames = 0f;
                float skillStagger = 0f;

                foreach (var hp in blueprint.HitPoints)
                {
                    skillDamageRatio += hp.DamagePerMyriad;
                    if (hp.CanAirborne || hp.CanKnockDown) skillStagger += 1f;
                    else if (hp.CanStiffness) skillStagger += 0.3f;
                }

                // 技能循环时间 = 动作帧 + 冷却时间
                float cooldownSec = info != null ? info.CooldownMs / 1000f : 0f;
                float durationSec = blueprint.ContinuousFrames / FPS;
                float cycleSec    = durationSec + cooldownSec;

                if (cycleSec > 0)
                    totalDamageRatio += (skillDamageRatio / DamageRatioScale) / cycleSec;

                // 控制覆盖（有控制打击点则累加）
                if (skillStagger > 0) controlCoverage += skillStagger * 0.2f;
            }

            float dps = baseAttack * totalDamageRatio;

            return new SkillEvaluationResult
            {
                EffectiveDPS    = dps,
                TotalDamageRatio = totalDamageRatio,
                ControlCoverage  = System.Math.Min(controlCoverage, 1f),
                ControlScore     = System.Math.Min(controlCoverage, 1f),
            };
        }
    }
}
