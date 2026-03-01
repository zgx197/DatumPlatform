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
    }
}
