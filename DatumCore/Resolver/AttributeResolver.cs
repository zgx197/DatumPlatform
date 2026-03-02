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

        // 元素抗性（万分比）
        public float IceRes;
        public float FireRes;
        public float PoisonRes;
        public float EleRes;

        public SnapshotMetadata Metadata;
    }

    public static class AttributeResolver
    {
        public static ResolvedAttributeSnapshot Resolve(AttributeSnapshot snapshot)
        {
            return new ResolvedAttributeSnapshot
            {
                FinalAtk    = snapshot.GetAttr(MonsterSnapshotBuilder.RoleAtkValue),
                FinalDef    = snapshot.GetAttr(MonsterSnapshotBuilder.RoleDefValue),
                FinalHP     = snapshot.GetAttr(MonsterSnapshotBuilder.RoleHPValue),
                AtkSpeedPro = snapshot.GetAttr(MonsterSnapshotBuilder.AtkSpeedPro),
                ToughMax    = snapshot.GetAttr(MonsterSnapshotBuilder.ToughMax),
                IceRes      = snapshot.GetAttr(MonsterSnapshotBuilder.IceRes),
                FireRes     = snapshot.GetAttr(MonsterSnapshotBuilder.FireRes),
                PoisonRes   = snapshot.GetAttr(MonsterSnapshotBuilder.PoisonRes),
                EleRes      = snapshot.GetAttr(MonsterSnapshotBuilder.EleRes),
                Metadata    = snapshot.Metadata,
            };
        }
    }
}
