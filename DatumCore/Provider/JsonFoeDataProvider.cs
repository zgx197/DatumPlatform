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
        private List<DatumBuffConfigRow> _buffConfigList = new();
        private Dictionary<int, DatumBuffConfigRow> _buffConfigMap = new();

        public JsonFoeDataProvider(
            string monstersJson,
            string skillInfoJson,
            string blueprintsJson,
            string buffConfigsJson = "[]")
        {
            LoadMonsters(monstersJson);
            LoadSkillInfo(skillInfoJson);
            LoadBlueprints(blueprintsJson);
            LoadBuffConfigs(buffConfigsJson);
        }

        private static readonly JsonSerializerOptions _jsonOpts = new()
        {
            PropertyNameCaseInsensitive = true,
            IncludeFields = true,
        };

        private void LoadMonsters(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            _foeRows = JsonSerializer.Deserialize<List<DatumFoeRow>>(json, _jsonOpts) ?? new();
            foreach (var row in _foeRows)
                _foeMap[row.ConfigId] = row;
        }

        private void LoadSkillInfo(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            var rows = JsonSerializer.Deserialize<List<DatumSkillInfoRow>>(json, _jsonOpts) ?? new();
            foreach (var row in rows)
                _skillInfoMap[row.SkillId] = row;
        }

        private void LoadBlueprints(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            var rows = JsonSerializer.Deserialize<List<DatumSkillBlueprint>>(json, _jsonOpts) ?? new();
            foreach (var bp in rows)
                _blueprintMap[bp.SkillId] = bp;
        }

        private void LoadBuffConfigs(string json)
        {
            if (string.IsNullOrEmpty(json)) return;
            _buffConfigList = JsonSerializer.Deserialize<List<DatumBuffConfigRow>>(json, _jsonOpts) ?? new();
            foreach (var row in _buffConfigList)
                _buffConfigMap[row.ConfigId] = row;
        }

        public IReadOnlyList<DatumFoeRow> GetAllFoeRows() => _foeRows;

        public bool TryGetFoeRow(int configId, out DatumFoeRow row)
            => _foeMap.TryGetValue(configId, out row);

        public DatumSkillBlueprint GetSkillBlueprint(int skillId)
            => _blueprintMap.TryGetValue(skillId, out var bp) ? bp : null;

        public DatumSkillInfoRow GetSkillInfoRow(int skillId)
            => _skillInfoMap.TryGetValue(skillId, out var row) ? row : null;

        public DatumBuffConfigRow GetBuffConfig(int buffConfigId)
            => _buffConfigMap.TryGetValue(buffConfigId, out var row) ? row : null;

        public IReadOnlyList<DatumBuffConfigRow> GetAllBuffConfigs() => _buffConfigList;

        public void ClearCache()
        {
            // JSON Provider 无运行时缓存需要清理
        }
    }
}
