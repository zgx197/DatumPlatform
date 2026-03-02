namespace Datum.Core.Metrics
{
    public class CombatMetrics
    {
        public float EffectiveHP;
        public float DPS;
        public float ControlScore;
        public float ToughnessDPS;

        // DPS 分解
        public float SkillDPS;
        public float DotDPS;

        // Control 分解
        public float SkillControlScore;
        public float BuffControlScore;

        // EHP 修正因子
        public float ElementResistanceFactor = 1f;
        public float PassiveBuffModifier = 1f;
    }
}
