using Datum.Core.Snapshot;

namespace Datum.Core.Resolver
{
    public class ResolvedAttributeSnapshot
    {
        public float FinalAtk;
        public float FinalDef;
        public float FinalHP;
        public float AtkSpeedPro;
        public float ToughMax;
        public SnapshotMetadata Metadata;
    }

    public static class AttributeResolver
    {
        public static ResolvedAttributeSnapshot Resolve(AttributeSnapshot snapshot)
        {
            float baseAtk     = snapshot.GetAttr(MonsterSnapshotBuilder.RoleAtkValue);
            float addAtk      = snapshot.GetAttr(MonsterSnapshotBuilder.RoleAtkValueAdd);
            float addAtkRatio = snapshot.GetAttr(MonsterSnapshotBuilder.RoleAtkValueAddRatio);

            float baseDef     = snapshot.GetAttr(MonsterSnapshotBuilder.RoleDefValue);
            float addDef      = snapshot.GetAttr(MonsterSnapshotBuilder.RoleDefValueAdd);
            float addDefRatio = snapshot.GetAttr(MonsterSnapshotBuilder.RoleDefValueAddRatio);

            float baseHP      = snapshot.GetAttr(MonsterSnapshotBuilder.RoleHPValue);
            float addHP       = snapshot.GetAttr(MonsterSnapshotBuilder.RoleHPValueAdd);
            float addHPRatio  = snapshot.GetAttr(MonsterSnapshotBuilder.RoleHPValueAddRatio);

            float atkSpeedPro = snapshot.GetAttr(MonsterSnapshotBuilder.AtkSpeed);
            float toughMax    = snapshot.GetAttr(MonsterSnapshotBuilder.ToughMax);

            return new ResolvedAttributeSnapshot
            {
                FinalAtk    = CalcFinalValue(baseAtk, addAtk, addAtkRatio),
                FinalDef    = CalcFinalValue(baseDef, addDef, addDefRatio),
                FinalHP     = baseHP > 0 ? CalcFinalValue(baseHP, addHP, addHPRatio) : 0f,
                AtkSpeedPro = atkSpeedPro,
                ToughMax    = toughMax,
                Metadata    = snapshot.Metadata,
            };
        }

        private static float CalcFinalValue(float baseVal, float addVal, float addRatio)
            => (baseVal + addVal) * (1f + addRatio / 10000f);
    }
}
