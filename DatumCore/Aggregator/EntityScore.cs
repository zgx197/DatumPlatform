using System.Collections.Generic;

namespace Datum.Core.Aggregator
{
    public class EntityScore
    {
        public int ConfigId;
        public string Name;
        public int FoeType;
        public int BarriesId;
        public float OverallScore;
        public float EHPScore;
        public float DPSScore;
        public float ControlScore;
        public Dictionary<string, float> NormalizedValues = new();
    }
}
