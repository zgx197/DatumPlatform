using System.Collections.Generic;

namespace Datum.Core.Aggregator
{
    public class EntityScore
    {
        public int ConfigId { get; set; }
        public string Name { get; set; }
        public int FoeType { get; set; }
        public int BarriesId { get; set; }
        public float OverallScore { get; set; }
        public float EHPScore { get; set; }
        public float DPSScore { get; set; }
        public float ControlScore { get; set; }
        public Dictionary<string, float> NormalizedValues { get; set; } = new();

        // DPS 分解（原始值，非归一化）
        public float SkillDPS { get; set; }
        public float DotDPS { get; set; }

        // Control 分解（原始值）
        public float SkillControlScore { get; set; }
        public float BuffControlScore { get; set; }

        // EHP 修正因子
        public float ElementResistanceFactor { get; set; } = 1f;
        public float PassiveBuffModifier { get; set; } = 1f;
    }
}
