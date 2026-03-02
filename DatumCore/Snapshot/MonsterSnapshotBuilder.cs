using Datum.Core.Provider;

namespace Datum.Core.Snapshot
{
    /// <summary>
    /// 从 DatumFoeRow 构建 AttributeSnapshot。
    /// 属性类型使用整数常量（与 Unity 侧 MazeAiAttrType 枚举值对应）。
    /// </summary>
    public static class MonsterSnapshotBuilder
    {
        // 属性类型常量（对应 FrameSyncEngine.MazeAiAttrType）
        public const int RoleHPValue         = 1;
        public const int RoleAtkValue        = 4;
        public const int RoleDefValue        = 7;
        public const int AtkSpeedPro         = 10;
        public const int ToughMax            = 11;
        public const int IceRes              = 21;
        public const int FireRes             = 20;
        public const int PoisonRes           = 22;
        public const int EleRes              = 23;

        public static AttributeSnapshot BuildFromRow(DatumFoeRow row)
        {
            var snapshot = new AttributeSnapshot { Source = SnapshotSource.FromRow };

            snapshot.Metadata.ConfigId         = row.ConfigId;
            snapshot.Metadata.Name             = row.Name ?? $"Monster_{row.ConfigId}";
            snapshot.Metadata.FoeType          = row.FoeType;
            snapshot.Metadata.BarriesId        = row.BarriesId;
            snapshot.Metadata.NorAttackSkillId = row.NorAttackSkillId;
            snapshot.Metadata.AttackSkillIds   = row.AttackSkillIds ?? new System.Collections.Generic.List<int>();

            snapshot.SetAttr(RoleHPValue,  row.HP);
            snapshot.SetAttr(RoleAtkValue, row.Attack);
            snapshot.SetAttr(RoleDefValue, row.Defence);
            snapshot.SetAttr(AtkSpeedPro,  row.AttackSpeedPro);
            snapshot.SetAttr(ToughMax,     row.ToughMax);
            snapshot.SetAttr(IceRes,       row.IceRes);
            snapshot.SetAttr(FireRes,      row.FireRes);
            snapshot.SetAttr(PoisonRes,    row.PoisonRes);
            snapshot.SetAttr(EleRes,       row.EleRes);

            return snapshot;
        }
    }
}
