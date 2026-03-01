using System.Collections.Generic;

namespace Datum.Core.Provider
{
    /// <summary>
    /// 数据提供者接口，抽象怪物数据的来源（Unity 资产 / JSON 文件 / 其他项目）。
    /// </summary>
    public interface IFoeDataProvider
    {
        IReadOnlyList<DatumFoeRow> GetAllFoeRows();
        bool TryGetFoeRow(int configId, out DatumFoeRow row);
        DatumSkillBlueprint GetSkillBlueprint(int skillId);
        DatumSkillInfoRow GetSkillInfoRow(int skillId);
        void ClearCache();
    }
}
