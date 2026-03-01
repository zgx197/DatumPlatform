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
                    skillDamageRatio += hp.DamageRatio;
                    skillFrames = System.Math.Max(skillFrames, hp.Frame);
                    skillStagger += hp.StaggerValue;
                }

                float cooldownSec = info != null ? info.Cooldown / 1000f : 0f;
                float durationSec = skillFrames / FPS;
                float cycleSec = System.Math.Max(durationSec, cooldownSec);

                if (cycleSec > 0)
                    totalDamageRatio += (skillDamageRatio / DamageRatioScale) / cycleSec;

                // 控制覆盖（粗略估算：有控制打击点则累加）
                if (skillStagger > 0) controlCoverage += 0.3f;
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
