using System.Collections.Generic;

namespace Datum.Core.Template
{
    /// <summary>
    /// 模板属性维度定义（10 维）。
    /// </summary>
    public static class TemplateAttrDef
    {
        public static readonly string[] Names =
        {
            "Atk", "Def", "HP", "AtkSpd", "Tough",
            "Spd", "IceR", "FireR", "PoiR", "EleR"
        };
        public const int Count = 10;
    }

    /// <summary>
    /// 模板变种（单个配置行的属性原始值和缩放系数）。
    /// </summary>
    public class TemplateVariant
    {
        public int ConfigId { get; set; }
        public string Name { get; set; }
        public float[] RawValues { get; set; } = new float[TemplateAttrDef.Count];
        public float[] Scales    { get; set; } = new float[TemplateAttrDef.Count];
        public float Score { get; set; }
    }

    /// <summary>
    /// 怪物模板（同类型不同等级的怪物组）。
    /// </summary>
    public class MonsterTemplate
    {
        public string ClusterKey { get; set; }
        public int FoeType { get; set; }
        public List<int> SortedSkillIds { get; set; } = new();
        public float[] BaseValues { get; set; } = new float[TemplateAttrDef.Count];
        public List<TemplateVariant> Variants { get; set; } = new();
        public bool HasConsistencyIssue { get; set; }
    }

    /// <summary>
    /// 模板注册表（所有模板的集合）。
    /// </summary>
    public class MonsterTemplateRegistry
    {
        public List<MonsterTemplate> Templates { get; set; } = new();
    }
}
