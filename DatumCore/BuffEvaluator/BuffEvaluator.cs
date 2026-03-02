using System;
using System.Collections.Generic;
using Datum.Core.Provider;

namespace Datum.Core.BuffEvaluator
{
    /// <summary>
    /// Buff 评估结果
    /// </summary>
    public class BuffEvaluationResult
    {
        /// <summary>DOT DPS（基于怪物攻击力 × Buff 系数 × 命中率）</summary>
        public float DotDPS;

        /// <summary>控制类 Buff 总时长（秒）</summary>
        public float ControlDurationSec;

        /// <summary>被动 Buff 对 EHP 的修正因子（≥1.0）</summary>
        public float PassiveEHPModifier = 1.0f;

        /// <summary>各 Buff 的分解明细</summary>
        public List<BuffBreakdown> Breakdowns = new();
    }

    public class BuffBreakdown
    {
        public int BuffConfigId;
        public string Category;   // "DOT" / "Control" / "PassiveDefense"
        public float Value;       // DOT: DPS 值, Control: 秒, Passive: 修正因子
    }

    /// <summary>
    /// Buff 评估器：解析怪物技能和被动技能关联的 Buff，
    /// 计算 DOT DPS、控制时长、被动防御修正。
    /// </summary>
    public static class BuffEvaluator
    {
        // 已知逻辑 ID 前缀分类（基于 FightBuffConfig 注册表）
        // 83xxxxx = 火系, 84xxxxx = 冰系, 85xxxxx = 电系, 86xxxxx = 毒系
        // 逻辑 ID 尾部 010 = DOT 类, 020 = 瞬时伤害类, 010(被动) = 持续增益类

        private const float DamageRatioScale = 10000f;

        /// <summary>
        /// 评估一个怪物的所有 Buff 效果。
        /// </summary>
        /// <param name="row">怪物数据行</param>
        /// <param name="provider">数据提供者</param>
        /// <returns>Buff 评估结果</returns>
        public static BuffEvaluationResult Evaluate(DatumFoeRow row, IFoeDataProvider provider)
        {
            var result = new BuffEvaluationResult();
            var processedBuffIds = new HashSet<int>();

            // 1. 收集所有攻击技能关联的 Buff
            var allAttackSkills = new List<int>(row.AttackSkillIds ?? new List<int>());
            if (row.NorAttackSkillId > 0 && !allAttackSkills.Contains(row.NorAttackSkillId))
                allAttackSkills.Add(row.NorAttackSkillId);

            foreach (var skillId in allAttackSkills)
            {
                var bp = provider.GetSkillBlueprint(skillId);
                if (bp?.AttachedBuffIds == null) continue;

                foreach (var buffId in bp.AttachedBuffIds)
                {
                    if (!processedBuffIds.Add(buffId)) continue;
                    var buffCfg = provider.GetBuffConfig(buffId);
                    if (buffCfg == null) continue;

                    EvaluateSkillBuff(buffCfg, row.Attack, result);
                }
            }

            // 2. 收集被动技能关联的 Buff
            if (row.PassiveSkillIds != null)
            {
                foreach (var passiveSkillId in row.PassiveSkillIds)
                {
                    var info = provider.GetSkillInfoRow(passiveSkillId);
                    if (info?.SelfEffectBuffIds == null) continue;

                    foreach (var buffId in info.SelfEffectBuffIds)
                    {
                        if (!processedBuffIds.Add(buffId)) continue;
                        var buffCfg = provider.GetBuffConfig(buffId);
                        if (buffCfg == null) continue;

                        EvaluatePassiveBuff(buffCfg, result);
                    }
                }
            }

            return result;
        }

        /// <summary>
        /// 评估攻击技能附带的 Buff（DOT 或瞬时伤害）。
        /// </summary>
        private static void EvaluateSkillBuff(DatumBuffConfigRow cfg, float monsterAtk, BuffEvaluationResult result)
        {
            float hitRate = cfg.BaseHitrate / DamageRatioScale;

            // DOT Buff: 有持续伤害系数(AttrValue2 > 0)且有 tick 间隔(AttrValue8 > 0)
            if (cfg.AttrValue2 > 0 && cfg.AttrValue8 > 0 && cfg.LastTime > 0)
            {
                float damagePerTick = monsterAtk * (cfg.AttrValue2 / DamageRatioScale);
                float tickIntervalSec = cfg.AttrValue8 / 1000f;
                float durationSec = cfg.LastTime / 1000f;
                int tickCount = (int)(durationSec / tickIntervalSec);
                float totalDotDamage = damagePerTick * tickCount * hitRate;
                float dotDPS = durationSec > 0 ? totalDotDamage / durationSec : 0f;

                result.DotDPS += dotDPS;
                result.Breakdowns.Add(new BuffBreakdown
                {
                    BuffConfigId = cfg.ConfigId,
                    Category = "DOT",
                    Value = dotDPS,
                });
            }

            // 瞬时伤害 Buff: 有 AttrValue > 0 且有持续时间
            if (cfg.AttrValue > 0 && cfg.LastTime > 0)
            {
                float burstDamage = monsterAtk * (cfg.AttrValue / DamageRatioScale) * hitRate;
                float durationSec = cfg.LastTime / 1000f;
                float burstDPS = burstDamage / durationSec;

                result.DotDPS += burstDPS;
                result.Breakdowns.Add(new BuffBreakdown
                {
                    BuffConfigId = cfg.ConfigId,
                    Category = "DOT",
                    Value = burstDPS,
                });
            }

            // 控制类 Buff: 持续时间 > 0 且非永久(LastTime != -1)且命中率 > 0
            // 控制类通常没有伤害系数，但有持续时间和命中率
            if (cfg.AttrValue == 0 && cfg.AttrValue2 == 0 && cfg.LastTime > 0 && cfg.LastTime != -1)
            {
                float controlSec = (cfg.LastTime / 1000f) * hitRate;
                result.ControlDurationSec += controlSec;
                result.Breakdowns.Add(new BuffBreakdown
                {
                    BuffConfigId = cfg.ConfigId,
                    Category = "Control",
                    Value = controlSec,
                });
            }
        }

        /// <summary>
        /// 评估被动技能 Buff（防御/增益类修正）。
        /// 被动 Buff 通常是 LastTime=-1（永久）的自身增益。
        /// </summary>
        private static void EvaluatePassiveBuff(DatumBuffConfigRow cfg, BuffEvaluationResult result)
        {
            // 被动 Buff 的 EHP 修正策略：
            // - 永久 Buff (LastTime == -1)：视为防御性被动
            //   - 免疫类（如免疫燃烧/迟缓/麻痹/中毒）：×1.3
            //   - 霸体类：×1.3
            //   - 无敌类：×1.5
            //   - 回血类：根据回血量估算
            // 当前使用简单的固定修正因子
            if (cfg.LastTime == -1)
            {
                // 永久被动 Buff，给予 EHP 修正
                float modifier = 1.3f;
                result.PassiveEHPModifier *= modifier;
                result.Breakdowns.Add(new BuffBreakdown
                {
                    BuffConfigId = cfg.ConfigId,
                    Category = "PassiveDefense",
                    Value = modifier,
                });
            }
        }
    }
}
