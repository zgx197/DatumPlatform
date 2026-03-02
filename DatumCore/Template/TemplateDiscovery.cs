using System;
using System.Collections.Generic;
using System.Linq;
using Datum.Core.Provider;

namespace Datum.Core.Template
{
    /// <summary>
    /// 从 IFoeDataProvider 自动发现怪物模板（按 FoeType + 技能组聚类）。
    /// </summary>
    public static class TemplateDiscovery
    {
        public static List<MonsterTemplate> Discover(IFoeDataProvider provider)
        {
            var rows = provider.GetAllFoeRows();
            var groups = new Dictionary<string, List<DatumFoeRow>>();

            foreach (var row in rows)
            {
                string key = BuildClusterKey(row);
                if (!groups.TryGetValue(key, out var list))
                    groups[key] = list = new List<DatumFoeRow>();
                list.Add(row);
            }

            var templates = new List<MonsterTemplate>();
            foreach (var kv in groups)
            {
                if (kv.Value.Count < 2) continue;
                templates.Add(BuildTemplate(kv.Key, kv.Value));
            }
            return templates;
        }

        private static string BuildClusterKey(DatumFoeRow row)
        {
            var sortedSkills = GetSortedSkillIds(row);
            return $"{row.FoeType}|{string.Join(",", sortedSkills)}";
        }

        private static List<int> GetSortedSkillIds(DatumFoeRow row)
        {
            var ids = new List<int>(row.AttackSkillIds ?? new List<int>());
            ids.Sort();
            return ids;
        }

        private static MonsterTemplate BuildTemplate(string key, List<DatumFoeRow> rows)
        {
            // 以属性值最小的行作为基准（最低等级）
            var baseRow = rows[0];
            foreach (var r in rows)
                if (r.Attack < baseRow.Attack) baseRow = r;

            float[] baseValues = ExtractAttrs(baseRow);

            var tmpl = new MonsterTemplate
            {
                ClusterKey    = key,
                FoeType       = baseRow.FoeType,
                SortedSkillIds = GetSortedSkillIds(baseRow),
                BaseValues    = baseValues,
            };

            foreach (var row in rows.OrderBy(r => r.Attack))
            {
                float[] raw    = ExtractAttrs(row);
                float[] scales = new float[TemplateAttrDef.Count];
                for (int i = 0; i < TemplateAttrDef.Count; i++)
                    scales[i] = baseValues[i] > 0 ? raw[i] / baseValues[i] : 0f;

                tmpl.Variants.Add(new TemplateVariant
                {
                    ConfigId  = row.ConfigId,
                    Name      = row.Name,
                    RawValues = raw,
                    Scales    = scales,
                });
            }
            return tmpl;
        }

        private static float[] ExtractAttrs(DatumFoeRow row)
        {
            return new float[]
            {
                row.Attack,
                row.Defence,
                row.HP,
                row.AttackSpeedPro,
                row.ToughMax,
                row.Speed,
                row.IceRes,
                row.FireRes,
                row.PoisonRes,
                row.EleRes,
            };
        }
    }
}
