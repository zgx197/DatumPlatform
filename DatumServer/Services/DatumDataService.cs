using System.Reflection;
using Datum.Core.Aggregator;
using Datum.Core.LevelAggregator;
using Datum.Core.Provider;
using Datum.Core.Calibrator;
using Datum.Core.Template;
using Datum.Server.Models;

namespace Datum.Server.Services
{
    public class DatumDataService
    {
        private static readonly System.Text.Json.JsonSerializerOptions _jsonOpts = new()
        {
            PropertyNameCaseInsensitive = true,
            IncludeFields = true,
        };

        private JsonFoeDataProvider? _provider;
        private EvaluationWeightConfig _weightConfig = new();
        private List<EntityScore> _cachedScores = new();
        private MonsterTemplateRegistry _registry = new();
        private List<CalibrationSample> _calibrationSamples = new();
        private List<LevelStructure> _levelStructures = new();
        private string _dataDir = string.Empty;

        public string DataDir => _dataDir;
        public string Version => Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

        public void LoadFromDirectory(string dir)
        {
            if (!Directory.Exists(dir))
            {
                Console.WriteLine($"[DatumDataService] 数据目录不存在：{dir}，将以空数据启动。");
                _provider = new JsonFoeDataProvider("[]", "[]", "[]");
                _dataDir = dir;
                return;
            }

            _dataDir = dir;

            string Read(string filename)
            {
                var path = Path.Combine(dir, filename);
                return File.Exists(path) ? File.ReadAllText(path) : "[]";
            }

            _provider = new JsonFoeDataProvider(
                Read("monsters.json"),
                Read("skill_info.json"),
                Read("skill_blueprints.json"),
                Read("buff_configs.json"));

            // 加载权重配置
            var weightPath = Path.Combine(dir, "weight_config.json");
            if (File.Exists(weightPath))
            {
                try
                {
                    var json = File.ReadAllText(weightPath);
                    _weightConfig = System.Text.Json.JsonSerializer.Deserialize<EvaluationWeightConfig>(json, _jsonOpts)
                        ?? new EvaluationWeightConfig();
                }
                catch { /* 解析失败则使用默认权重 */ }
            }

            // 加载校准样本（兼容 Unity 导出的 snake_case 字段名）
            var calibPath = Path.Combine(dir, "calibration.json");
            if (File.Exists(calibPath))
            {
                try
                {
                    var json = File.ReadAllText(calibPath)
                        .Replace("\"config_id\"",        "\"configId\"")
                        .Replace("\"subjective_score\"", "\"subjectiveScore\"")
                        .Replace("\"ehp_norm\"",         "\"ehpNorm\"")
                        .Replace("\"dps_norm\"",         "\"dpsNorm\"")
                        .Replace("\"control_norm\"",     "\"controlNorm\"");
                    _calibrationSamples = System.Text.Json.JsonSerializer.Deserialize<List<CalibrationSample>>(json, _jsonOpts)
                        ?? new List<CalibrationSample>();
                }
                catch { }
            }

            // 加载关卡结构
            var levelPath = Path.Combine(dir, "level_structure.json");
            if (File.Exists(levelPath))
            {
                try
                {
                    var json = File.ReadAllText(levelPath);
                    _levelStructures = System.Text.Json.JsonSerializer.Deserialize<List<LevelStructure>>(json, _jsonOpts)
                        ?? new List<LevelStructure>();
                }
                catch { _levelStructures = new List<LevelStructure>(); }
            }

            RecalculateScores();
            Console.WriteLine($"[DatumDataService] 加载完成：{_provider.GetAllFoeRows().Count} 个怪物，{_levelStructures.Count} 个关卡");
        }

        public void RecalculateScores()
        {
            if (_provider == null) return;
            _cachedScores = ScoreCalculator.CalculateAll(_provider, _weightConfig);

            var templates = TemplateDiscovery.Discover(_provider);
            var scoreMap = _cachedScores.ToDictionary(s => s.ConfigId, s => s.OverallScore);
            foreach (var tmpl in templates)
                foreach (var v in tmpl.Variants)
                    if (scoreMap.TryGetValue(v.ConfigId, out var s)) v.Score = s;

            _registry = new MonsterTemplateRegistry { Templates = templates };
        }

        public IReadOnlyList<EntityScore> GetScores() => _cachedScores;
        public IReadOnlyList<DatumFoeRow> GetMonsters() => _provider?.GetAllFoeRows() ?? new List<DatumFoeRow>();
        public EvaluationWeightConfig GetWeightConfig() => _weightConfig;
        public MonsterTemplateRegistry GetRegistry() => _registry;
        public IReadOnlyList<CalibrationSample> GetCalibrationSamples() => _calibrationSamples;
        public IReadOnlyList<LevelStructure> GetLevelStructures() => _levelStructures;

        public List<LevelMetrics> GetLevelMetrics(float? lifetimeOverride = null)
        {
            if (_levelStructures.Count == 0) return new List<LevelMetrics>();

            var foeTypes = (_provider?.GetAllFoeRows() ?? new List<DatumFoeRow>())
                .Select(r => (r.ConfigId, r.FoeType))
                .ToList();

            float lifetime = lifetimeOverride ?? Core.LevelAggregator.LevelAggregator.DefaultMonsterLifetimeSec;
            return Core.LevelAggregator.LevelAggregator.CalculateAll(
                _levelStructures, _cachedScores, foeTypes, lifetime, _provider);
        }

        public List<EntityScore> RecalculateWithWeights(EvaluationWeightConfig weights)
        {
            if (_provider == null) return new List<EntityScore>();
            return ScoreCalculator.CalculateAll(_provider, weights);
        }

        public void UpdateWeightConfig(EvaluationWeightConfig weights)
        {
            _weightConfig = weights;
            RecalculateScores();
        }

        /// <summary>
        /// 生成难度档位摘要（供外部工具如关卡编辑器消费）。
        /// 阈值基于当前评分的百分位数自动划定：P33=easy/medium分界，P66=medium/hard，P90=hard/boss。
        /// </summary>
        public DifficultyTiersSummary GetDifficultyTiers()
        {
            var scores = _cachedScores;
            if (scores.Count == 0)
                return new DifficultyTiersSummary();

            var sorted = scores.Select(s => s.OverallScore).OrderBy(v => v).ToList();
            float Percentile(int pct) => sorted[(int)Math.Min(Math.Floor(sorted.Count * pct / 100.0), sorted.Count - 1)];

            var thresholds = new DifficultyThresholds
            {
                Easy   = (float)Math.Round(Percentile(33), 3),
                Medium = (float)Math.Round(Percentile(66), 3),
                Hard   = (float)Math.Round(Percentile(90), 3),
            };

            string Tier(float v) => v < thresholds.Easy ? "easy"
                : v < thresholds.Medium ? "medium"
                : v < thresholds.Hard   ? "hard"
                : "boss";

            var monsters = scores.Select(s => new MonsterTierEntry
            {
                ConfigId  = s.ConfigId,
                Name      = s.Name,
                FoeType   = s.FoeType,
                Score     = (float)Math.Round(s.OverallScore, 3),
                EhpScore  = (float)Math.Round(s.EHPScore, 3),
                DpsScore  = (float)Math.Round(s.DPSScore, 3),
                BarriesId = s.BarriesId,
                Tier      = Tier(s.OverallScore),
            }).OrderByDescending(m => m.Score).ToList();

            return new DifficultyTiersSummary
            {
                GeneratedAt = DateTime.UtcNow.ToString("o"),
                Thresholds  = thresholds,
                Monsters    = monsters,
            };
        }

        public bool SaveCalibrationSamples(List<CalibrationSample> samples)
        {
            if (string.IsNullOrEmpty(_dataDir)) return false;
            try
            {
                _calibrationSamples = samples;
                var path = Path.Combine(_dataDir, "calibration.json");
                var writeOpts = new System.Text.Json.JsonSerializerOptions
                {
                    WriteIndented = true,
                    IncludeFields = true,
                };
                File.WriteAllText(path, System.Text.Json.JsonSerializer.Serialize(samples, writeOpts),
                    System.Text.Encoding.UTF8);
                return true;
            }
            catch { return false; }
        }
    }
}
