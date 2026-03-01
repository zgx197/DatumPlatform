using System;
using System.Collections.Generic;

namespace Datum.Core.Provider
{
    /// <summary>
    /// 怪物基础数据行（POCO），从配置表或 JSON 反序列化。
    /// </summary>
    [Serializable]
    public class DatumFoeRow
    {
        public int ConfigId { get; set; }
        public string Name { get; set; }
        public int FoeType { get; set; }
        public int BarriesId { get; set; }

        // 基础战斗属性
        public float HP { get; set; }
        public float Attack { get; set; }
        public float Defence { get; set; }
        public float AtkSpeed { get; set; }
        public float ToughMax { get; set; }

        // 加成属性
        public float AtkAdd { get; set; }
        public float AtkAddRatio { get; set; }
        public float DefAdd { get; set; }
        public float DefAddRatio { get; set; }
        public float HPAdd { get; set; }
        public float HPAddRatio { get; set; }

        // 元素抗性
        public float FireRes { get; set; }
        public float IceRes { get; set; }
        public float ThunderRes { get; set; }
        public float WindRes { get; set; }
        public float QuantumRes { get; set; }
        public float ImaginaryRes { get; set; }
        public float PhysicsRes { get; set; }

        // 技能信息
        public List<int> AttackSkillIds { get; set; }
        public int NorAttackSkillId { get; set; }

        // 扩展字段（不同项目自定义属性）
        public Dictionary<string, float> Extensions { get; set; }
    }

    /// <summary>
    /// 技能基础配置行（冷却时间、消耗等）。
    /// </summary>
    [Serializable]
    public class DatumSkillInfoRow
    {
        public int SkillId { get; set; }
        public float Cooldown { get; set; }
        public float Cost { get; set; }
        public string SkillName { get; set; }
    }

    /// <summary>
    /// 技能蓝图（从 SkillConfigAsset 预提取的打击点数据）。
    /// </summary>
    [Serializable]
    public class DatumSkillBlueprint
    {
        public int SkillId { get; set; }
        public List<DatumHitPoint> HitPoints { get; set; }
    }

    /// <summary>
    /// 单个打击点（帧数 + 伤害倍率）。
    /// </summary>
    [Serializable]
    public class DatumHitPoint
    {
        public int Frame { get; set; }
        public float DamageRatio { get; set; }
        public float StaggerValue { get; set; }
    }
}
