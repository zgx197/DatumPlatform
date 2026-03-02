using System.Reflection;
using Datum.Core.Aggregator;
using Datum.Core.Provider;
using Datum.Core.Calibrator;
using Datum.Core.Template;

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

            // 加载校准样本
            var calibPath = Path.Combine(dir, "calibration.json");
            if (File.Exists(calibPath))
            {
                try
                {
                    var json = File.ReadAllText(calibPath);
                    _calibrationSamples = System.Text.Json.JsonSerializer.Deserialize<List<CalibrationSample>>(json, _jsonOpts)
                        ?? new List<CalibrationSample>();
                }
                catch { }
            }

            RecalculateScores();
            Console.WriteLine($"[DatumDataService] 加载完成：{_provider.GetAllFoeRows().Count} 个怪物");
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
