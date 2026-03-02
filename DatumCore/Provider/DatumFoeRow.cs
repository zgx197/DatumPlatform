using System;
using System.Collections.Generic;

namespace Datum.Core.Provider
{
    /// <summary>
    /// 怪物基础数据行（POCO），从配置表或 JSON 反序列化。
    /// 字段命名与 Unity 导出 JSON 一致。
    /// </summary>
    [Serializable]
    public class DatumFoeRow
    {
        public int ConfigId { get; set; }
        public string Name { get; set; }
        public int Level { get; set; }
        public int FoeType { get; set; }
        public int ModelId { get; set; }
        public int BarriesId { get; set; }

        // 基础战斗属性
        public float HP { get; set; }
        public float Attack { get; set; }
        public float Defence { get; set; }
        public float ToughMax { get; set; }
        public float Speed { get; set; }
        public float AttackSpeedPro { get; set; }

        // 元素抗性（万分比，与 Unity 侧 MazeFoeV8 字段一致）
        public float IceRes { get; set; }
        public float FireRes { get; set; }
        public float PoisonRes { get; set; }
        public float EleRes { get; set; }

        // 技能引用
        public int NorAttackSkillId { get; set; }
        public List<int> AttackSkillIds { get; set; } = new();

        // 被动技能引用（用于解析被动 Buff）
        public List<int> PassiveSkillIds { get; set; } = new();
    }

    /// <summary>
    /// 技能基础配置行（冷却时间、消耗等）。
    /// </summary>
    [Serializable]
    public class DatumSkillInfoRow
    {
        public int SkillId { get; set; }
        public string Name { get; set; }
        public int CooldownMs { get; set; }

        // 被动技能自带 Buff ID 列表（Self_effect 字段）
        public List<int> SelfEffectBuffIds { get; set; } = new();
    }

    /// <summary>
    /// 技能蓝图（从 SkillConfigAsset 预提取的打击点数据）。
    /// </summary>
    [Serializable]
    public class DatumSkillBlueprint
    {
        public int SkillId { get; set; }
        public int ContinuousFrames { get; set; }
        public int CastPriority { get; set; }
        public List<DatumHitPoint> HitPoints { get; set; } = new();

        // 技能附带的 Buff ID 列表（从 SkillAddBuffAbilityConfig.BuffIDList 提取）
        public List<int> AttachedBuffIds { get; set; } = new();
    }

    /// <summary>
    /// 单个打击点（万分比伤害 + 控制效果）。
    /// </summary>
    [Serializable]
    public class DatumHitPoint
    {
        public int DamagePerMyriad { get; set; }   // 万分比伤害系数
        public int DamageElement { get; set; }     // 伤害元素类型（ControlElementAttrResType 枚举值，0=物理）
        public bool CanAirborne { get; set; }
        public bool CanKnockDown { get; set; }
        public bool CanStiffness { get; set; }
        public int PoiseDamage { get; set; }
        public bool IsContinuous { get; set; }
    }

    /// <summary>
    /// Buff 配置行数据（对应 MazeSkilleffectV8 精选字段）。
    /// 用于计算 DOT DPS、控制时长等。
    /// </summary>
    [Serializable]
    public class DatumBuffConfigRow
    {
        public int ConfigId { get; set; }       // Buff 配置 ID
        public int LogicalId { get; set; }      // 逻辑 ID（Attr 字段）
        public int AttrValue { get; set; }      // 瞬时伤害系数
        public int AttrValue2 { get; set; }     // 持续伤害系数
        public int AttrValue8 { get; set; }     // tick 间隔 ms
        public int BaseHitrate { get; set; }    // 基础命中率（万分比）
        public int LastTime { get; set; }       // 持续时间 ms
        public int EffectGroup { get; set; }    // 效果组
    }
}
