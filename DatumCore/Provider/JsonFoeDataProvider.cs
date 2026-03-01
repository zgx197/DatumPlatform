using System;
using System.Collections.Generic;
using System.Text.Json;

namespace Datum.Core.Provider
{
    /// <summary>
    /// 从 datum_export/ 导出的 JSON 文件读取数据，供外部工具（DatumServer）使用。
    /// </summary>
    public class JsonFoeDataProvider : IFoeDataProvider
    {
        private List<DatumFoeRow> _foeRows = new();
        private Dictionary<int, DatumFoeRow> _foeMap = new();
        private Dictionary<int, DatumSkillInfoRow> _skillInfoMap = new();
        private Dictionary<int, DatumSkillBlueprint> _blueprintMap = new();

        public JsonFoeDataProvider(
            string monstersJson,
            string skillInfoJson,
            string blueprintsJson)
        {
            LoadMonsters(monstersJson);
            LoadSkillInfo(skillInfoJson);
            LoadBlueprints(blueprintsJson);
        }

        private void LoadMonsters(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            _foeRows = JsonSerializer.Deserialize<List<DatumFoeRow>>(json, options) ?? new();
            foreach (var row in _foeRows)
                _foeMap[row.ConfigId] = row;
        }

        private void LoadSkillInfo(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var rows = JsonSerializer.Deserialize<List<DatumSkillInfoRow>>(json, options) ?? new();
            foreach (var row in rows)
                _skillInfoMap[row.SkillId] = row;
        }

        private void LoadBlueprints(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var rows = JsonSerializer.Deserialize<List<DatumSkillBlueprint>>(json, options) ?? new();
            foreach (var bp in rows)
                _blueprintMap[bp.SkillId] = bp;
        }

        public IReadOnlyList<DatumFoeRow> GetAllFoeRows() => _foeRows;

        public bool TryGetFoeRow(int configId, out DatumFoeRow row)
            => _foeMap.TryGetValue(configId, out row);

        public DatumSkillBlueprint GetSkillBlueprint(int skillId)
            => _blueprintMap.TryGetValue(skillId, out var bp) ? bp : null;

        public DatumSkillInfoRow GetSkillInfoRow(int skillId)
            => _skillInfoMap.TryGetValue(skillId, out var row) ? row : null;

        public void ClearCache()
        {
            // JSON Provider 无运行时缓存需要清理
        }
    }
}
