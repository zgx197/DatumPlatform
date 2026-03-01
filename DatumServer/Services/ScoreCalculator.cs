using Datum.Core.Aggregator;
using Datum.Core.Metrics;
using Datum.Core.Provider;
using Datum.Core.Resolver;
using Datum.Core.Snapshot;

namespace Datum.Server.Services
{
    public static class ScoreCalculator
    {
        public static List<EntityScore> CalculateAll(
            IFoeDataProvider provider,
            EvaluationWeightConfig weightConfig)
        {
            var result = new List<EntityScore>();
            foreach (var row in provider.GetAllFoeRows())
            {
                var score = CalculateOne(row, provider, weightConfig);
                if (score != null) result.Add(score);
            }
            return result;
        }

        public static EntityScore? CalculateOne(
            DatumFoeRow row,
            IFoeDataProvider provider,
            EvaluationWeightConfig weightConfig)
        {
            try
            {
                var snapshot = MonsterSnapshotBuilder.BuildFromRow(row);
                var resolved = AttributeResolver.Resolve(snapshot);
                var skill    = Core.SkillEvaluator.SkillEvaluator.Evaluate(
                    snapshot.Metadata.AttackSkillIds,
                    snapshot.Metadata.NorAttackSkillId,
                    resolved.FinalAtk, provider);
                var metrics  = CombatMetricsCalculator.Calculate(
                    resolved, weightConfig.baseline_atk, weightConfig.baseline_def, skill);
                return ScoreAggregator.Aggregate(metrics, snapshot.Metadata, weightConfig);
            }
            catch
            {
                return null;
            }
        }
    }
}
