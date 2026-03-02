namespace Datum.Server.Models
{
    public class DifficultyThresholds
    {
        public float Easy   { get; set; }
        public float Medium { get; set; }
        public float Hard   { get; set; }
    }

    public class MonsterTierEntry
    {
        public int    ConfigId  { get; set; }
        public string Name      { get; set; } = "";
        public int    FoeType   { get; set; }
        public float  Score     { get; set; }
        public float  EhpScore  { get; set; }
        public float  DpsScore  { get; set; }
        public int    BarriesId { get; set; }
        public string Tier      { get; set; } = "easy";
    }

    public class DifficultyTiersSummary
    {
        public string                  GeneratedAt { get; set; } = "";
        public DifficultyThresholds    Thresholds  { get; set; } = new();
        public List<MonsterTierEntry>  Monsters    { get; set; } = new();
    }
}
