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
        public int ConfigId;
        public string Name;
        public int FoeType;
        public int BarriesId;

        // 基础战斗属性
        public float HP;
        public float Attack;
        public float Defence;
        public float AtkSpeed;
        public float ToughMax;

        // 加成属性
        public float AtkAdd;
        public float AtkAddRatio;
        public float DefAdd;
        public float DefAddRatio;
        public float HPAdd;
        public float HPAddRatio;

        // 元素抗性
        public float FireRes;
        public float IceRes;
        public float ThunderRes;
        public float WindRes;
        public float QuantumRes;
        public float ImaginaryRes;
        public float PhysicsRes;

        // 技能信息
        public List<int> AttackSkillIds;
        public int NorAttackSkillId;

        // 扩展字段（不同项目自定义属性）
        public Dictionary<string, float> Extensions;
    }

    /// <summary>
    /// 技能基础配置行（冷却时间、消耗等）。
    /// </summary>
    [Serializable]
    public class DatumSkillInfoRow
    {
        public int SkillId;
        public float Cooldown;
        public float Cost;
        public string SkillName;
    }

    /// <summary>
    /// 技能蓝图（从 SkillConfigAsset 预提取的打击点数据）。
    /// </summary>
    [Serializable]
    public class DatumSkillBlueprint
    {
        public int SkillId;
        public List<DatumHitPoint> HitPoints;
    }

    /// <summary>
    /// 单个打击点（帧数 + 伤害倍率）。
    /// </summary>
    [Serializable]
    public class DatumHitPoint
    {
        public int Frame;
        public float DamageRatio;
        public float StaggerValue;
    }
}
