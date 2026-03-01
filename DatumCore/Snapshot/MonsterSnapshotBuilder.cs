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
        public const int RoleHPValueAdd      = 2;
        public const int RoleHPValueAddRatio = 3;
        public const int RoleAtkValue        = 4;
        public const int RoleAtkValueAdd     = 5;
        public const int RoleAtkValueAddRatio= 6;
        public const int RoleDefValue        = 7;
        public const int RoleDefValueAdd     = 8;
        public const int RoleDefValueAddRatio= 9;
        public const int AtkSpeed            = 10;
        public const int ToughMax            = 11;
        public const int FireRes             = 20;
        public const int IceRes              = 21;
        public const int ThunderRes          = 22;
        public const int WindRes             = 23;
        public const int QuantumRes          = 24;
        public const int ImaginaryRes        = 25;
        public const int PhysicsRes          = 26;

        public static AttributeSnapshot BuildFromRow(DatumFoeRow row)
        {
            var snapshot = new AttributeSnapshot { Source = SnapshotSource.FromRow };

            snapshot.Metadata.ConfigId         = row.ConfigId;
            snapshot.Metadata.Name             = row.Name ?? $"Monster_{row.ConfigId}";
            snapshot.Metadata.FoeType          = row.FoeType;
            snapshot.Metadata.BarriesId        = row.BarriesId;
            snapshot.Metadata.NorAttackSkillId = row.NorAttackSkillId;
            snapshot.Metadata.AttackSkillIds   = row.AttackSkillIds ?? new System.Collections.Generic.List<int>();

            snapshot.SetAttr(RoleHPValue,          row.HP);
            snapshot.SetAttr(RoleHPValueAdd,       row.HPAdd);
            snapshot.SetAttr(RoleHPValueAddRatio,  row.HPAddRatio);
            snapshot.SetAttr(RoleAtkValue,         row.Attack);
            snapshot.SetAttr(RoleAtkValueAdd,      row.AtkAdd);
            snapshot.SetAttr(RoleAtkValueAddRatio, row.AtkAddRatio);
            snapshot.SetAttr(RoleDefValue,         row.Defence);
            snapshot.SetAttr(RoleDefValueAdd,      row.DefAdd);
            snapshot.SetAttr(RoleDefValueAddRatio, row.DefAddRatio);
            snapshot.SetAttr(AtkSpeed,             row.AtkSpeed);
            snapshot.SetAttr(ToughMax,             row.ToughMax);
            snapshot.SetAttr(FireRes,              row.FireRes);
            snapshot.SetAttr(IceRes,               row.IceRes);
            snapshot.SetAttr(ThunderRes,           row.ThunderRes);
            snapshot.SetAttr(WindRes,              row.WindRes);
            snapshot.SetAttr(QuantumRes,           row.QuantumRes);
            snapshot.SetAttr(ImaginaryRes,         row.ImaginaryRes);
            snapshot.SetAttr(PhysicsRes,           row.PhysicsRes);

            return snapshot;
        }
    }
}
