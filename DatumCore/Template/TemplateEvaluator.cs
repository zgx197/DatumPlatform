using System.Collections.Generic;
using Datum.Core.Aggregator;
using Datum.Core.Metrics;
using Datum.Core.Provider;
using Datum.Core.Resolver;
using Datum.Core.Snapshot;

namespace Datum.Core.Template
{
    public static class TemplateEvaluator
    {
        public static void EvaluateAll(
            MonsterTemplateRegistry registry,
            IFoeDataProvider provider,
            EvaluationWeightConfig weightConfig)
        {
            if (registry == null || provider == null || weightConfig == null) return;
            foreach (var tmpl in registry.Templates)
                EvaluateTemplate(tmpl, provider, weightConfig);
        }

        public static void EvaluateTemplate(
            MonsterTemplate tmpl,
            IFoeDataProvider provider,
            EvaluationWeightConfig weightConfig)
        {
            if (tmpl == null || tmpl.Variants.Count == 0) return;
            foreach (var variant in tmpl.Variants)
                variant.Score = ComputeScore(variant.ConfigId, provider, weightConfig);
        }

        private static float ComputeScore(
            int configId,
            IFoeDataProvider provider,
            EvaluationWeightConfig weightConfig)
        {
            if (!provider.TryGetFoeRow(configId, out var foeRow)) return 0f;

            var snapshot = MonsterSnapshotBuilder.BuildFromRow(foeRow);
            var resolved = AttributeResolver.Resolve(snapshot);
            var skill    = SkillEvaluator.SkillEvaluator.Evaluate(
                snapshot.Metadata.AttackSkillIds,
                snapshot.Metadata.NorAttackSkillId,
                resolved.FinalAtk, provider);
            var metrics  = CombatMetricsCalculator.Calculate(
                resolved, weightConfig.baseline_atk, weightConfig.baseline_def, skill);
            var score    = ScoreAggregator.Aggregate(metrics, snapshot.Metadata, weightConfig);

            return score.OverallScore;
        }
    }
}
