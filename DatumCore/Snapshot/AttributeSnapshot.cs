using System.Collections.Generic;
using Datum.Core.Provider;

namespace Datum.Core.Snapshot
{
    public enum SnapshotSource { FromRow, FromJson }

    public class SnapshotMetadata
    {
        public int ConfigId;
        public string Name;
        public int FoeType;
        public int BarriesId;
        public List<int> AttackSkillIds = new();
        public int NorAttackSkillId;
    }

    /// <summary>
    /// 原始属性快照：将 DatumFoeRow 中的字段映射为按属性类型索引的数组。
    /// </summary>
    public class AttributeSnapshot
    {
        public SnapshotSource Source;
        public SnapshotMetadata Metadata = new();

        private readonly Dictionary<int, float> _attrs = new();

        public void SetAttr(int attrType, float value) => _attrs[attrType] = value;
        public float GetAttr(int attrType) => _attrs.TryGetValue(attrType, out var v) ? v : 0f;
    }
}
