using System;
using System.Collections.Generic;
using System.Linq;
using Datum.Core.Aggregator;
using Datum.Core.Provider;

namespace Datum.Core.LevelAggregator
{
    /// <summary>
    /// 关卡维度聚合计算器。
    /// 根据关卡结构（波次/时间轴）和怪物评分，计算关卡级别的难度指标。
    /// </summary>
    public static class LevelAggregator
    {
        /// <summary>
        /// 假设怪物平均存活时间（秒），用于模拟同时在场数量
        /// </summary>
        public const float DefaultMonsterLifetimeSec = 30f;

        /// <summary>
        /// 元素类型名称映射（与 Unity ControlElementAttrResType 枚举一致）
        /// </summary>
        private static readonly Dictionary<int, string> ElementNames = new()
        {
            [0] = "physics",
            [1] = "ice",
            [2] = "fire",
            [3] = "poison",
            [4] = "electric",
        };

        /// <summary>
        /// 计算单个关卡的聚合指标
        /// </summary>
        public static LevelMetrics Calculate(
            LevelStructure level,
            IReadOnlyDictionary<int, EntityScore> scoreMap,
            IReadOnlyDictionary<int, int> foeTypeMap,
            float monsterLifetimeSec = DefaultMonsterLifetimeSec,
            IFoeDataProvider? provider = null)
        {
            var metrics = new LevelMetrics
            {
                LevelId = level.levelId,
                LevelName = level.levelName,
            };

            // 1. 收集所有刷怪事件（时间点 + 怪物列表）
            var spawnEvents = CollectSpawnEvents(level);

            // 2. 计算基础统计
            int totalMonsters = 0;
            float totalDifficulty = 0f;
            var typeDistribution = new Dictionary<string, int>
            {
                ["boss"] = 0, ["elite"] = 0, ["ordinary"] = 0
            };
            var elementDistribution = new Dictionary<string, int>
            {
                ["physics"] = 0, ["ice"] = 0, ["fire"] = 0, ["poison"] = 0, ["electric"] = 0
            };

            // 预构建 configId → 主要输出元素 缓存
            var elementCache = BuildElementCache(foeTypeMap.Keys, provider);

            foreach (var evt in spawnEvents)
            {
                foreach (int configId in evt.MonsterConfigIds)
                {
                    totalMonsters++;
                    float score = scoreMap.TryGetValue(configId, out var s) ? s.OverallScore : 0f;
                    totalDifficulty += score;

                    // 类型分布
                    int foeType = foeTypeMap.TryGetValue(configId, out var ft) ? ft : 0;
                    string typeKey = foeType switch
                    {
                        4 => "boss",
                        5 => "elite",
                        _ => "ordinary"
                    };
                    typeDistribution[typeKey]++;

                    // 元素分布
                    string elemKey = elementCache.TryGetValue(configId, out var ek) ? ek : "physics";
                    elementDistribution.TryAdd(elemKey, 0);
                    elementDistribution[elemKey]++;
                }
            }

            // 3. 预设怪物统计
            foreach (var preset in level.presetMonsters)
            {
                if (preset.monsterIds == null) continue;
                foreach (var idStr in preset.monsterIds)
                {
                    if (!int.TryParse(idStr, out int configId)) continue;
                    totalMonsters++;
                    float score = scoreMap.TryGetValue(configId, out var s) ? s.OverallScore : 0f;
                    totalDifficulty += score;

                    int foeType = foeTypeMap.TryGetValue(configId, out var ft) ? ft : 0;
                    string typeKey = foeType switch { 4 => "boss", 5 => "elite", _ => "ordinary" };
                    typeDistribution[typeKey]++;

                    string elemKey = elementCache.TryGetValue(configId, out var ek) ? ek : "physics";
                    elementDistribution.TryAdd(elemKey, 0);
                    elementDistribution[elemKey]++;
                }
            }

            metrics.TotalMonsterCount = totalMonsters;
            metrics.TotalDifficulty = totalDifficulty;
            metrics.MonsterTypeDistribution = typeDistribution;
            metrics.ElementDistribution = elementDistribution;

            // 4. 波次详情（按 regionId+triggerId+waveIndex 三元组合并，避免同一 triggerId 多配置行产生重复 key）
            var waveMap = new Dictionary<(int regionId, int triggerId, int waveIndex), WaveMetrics>();
            foreach (var trigger in level.triggers)
            {
                foreach (var wave in trigger.waves)
                {
                    var key = (trigger.regionId, trigger.triggerId, wave.waveIndex);
                    if (!waveMap.TryGetValue(key, out var wm))
                    {
                        wm = new WaveMetrics
                        {
                            TriggerId    = trigger.triggerId,
                            RegionId     = trigger.regionId,
                            WaveIndex    = wave.waveIndex,
                            DelaySeconds = wave.delayMs / 1000f,
                            Monsters     = new List<MonsterInWave>(),
                        };
                        waveMap[key] = wm;
                    }
                    // 合并怪物列表（同一 configId 累加 count）
                    foreach (var m in wave.monsters)
                    {
                        var existing = wm.Monsters.Find(x => x.configId == m.configId);
                        if (existing != null)
                            existing.count += m.count;
                        else
                            wm.Monsters.Add(new MonsterInWave { configId = m.configId, count = m.count });
                        wm.MonsterCount += m.count;
                        float score = scoreMap.TryGetValue(m.configId, out var s) ? s.OverallScore : 0f;
                        wm.WaveDifficulty += score * m.count;
                    }
                }
            }
            var waveDetails = waveMap.Values
                .OrderBy(w => w.RegionId).ThenBy(w => w.TriggerId).ThenBy(w => w.WaveIndex)
                .ToList();
            metrics.WaveCount = waveDetails.Count;
            metrics.WaveDetails = waveDetails;

            // 5. 难度曲线（按秒采样，模拟同时在场）
            if (spawnEvents.Count > 0)
            {
                float maxTime = spawnEvents.Max(e => e.TimeSeconds) + monsterLifetimeSec;
                metrics.DurationSeconds = maxTime;

                var curve = new List<DifficultyPoint>();
                float sampleInterval = 1f; // 每秒采样一次
                float peakDiff = 0f;

                for (float t = 0; t <= maxTime; t += sampleInterval)
                {
                    float aliveDiff = 0f;
                    int aliveCount = 0;

                    foreach (var evt in spawnEvents)
                    {
                        if (evt.TimeSeconds <= t && t < evt.TimeSeconds + monsterLifetimeSec)
                        {
                            foreach (int configId in evt.MonsterConfigIds)
                            {
                                aliveCount++;
                                aliveDiff += scoreMap.TryGetValue(configId, out var s) ? s.OverallScore : 0f;
                            }
                        }
                    }

                    // 预设怪物作为 t=0 时刻一次性出现
                    if (t < monsterLifetimeSec)
                    {
                        foreach (var preset in level.presetMonsters)
                        {
                            if (preset.monsterIds == null) continue;
                            foreach (var idStr in preset.monsterIds)
                            {
                                if (!int.TryParse(idStr, out int configId)) continue;
                                aliveCount++;
                                aliveDiff += scoreMap.TryGetValue(configId, out var s) ? s.OverallScore : 0f;
                            }
                        }
                    }

                    curve.Add(new DifficultyPoint
                    {
                        TimeSeconds = (float)Math.Round(t, 1),
                        Difficulty = (float)Math.Round(aliveDiff, 2),
                        AliveCount = aliveCount,
                    });

                    if (aliveDiff > peakDiff) peakDiff = aliveDiff;
                }

                metrics.DifficultyCurve = curve;
                metrics.PeakSimultaneousDifficulty = peakDiff;
                metrics.AverageDifficultyDensity = maxTime > 0 ? totalDifficulty / maxTime : 0f;

                // ─── 加速曲线：模拟玩家以固定速度击杀 ───────────
                // 假设每只怪物被击杀需要 killTimeSec 秒（基于其难度分值估算）
                // 怪物存活时间 = min(monsterLifetimeSec, killTimeSec * score / avgScore)
                float avgScore = totalMonsters > 0 ? totalDifficulty / totalMonsters : 1f;
                float baseKillTime = Math.Min(monsterLifetimeSec, 5f); // 基准5秒击杀一只均分怪

                var accelCurve = new List<DifficultyPoint>();
                float accelPeak = 0f;

                for (float t = 0; t <= maxTime; t += sampleInterval)
                {
                    float aliveDiff = 0f;
                    int aliveCount = 0;

                    foreach (var evt in spawnEvents)
                    {
                        if (evt.TimeSeconds > t) continue;
                        foreach (int configId in evt.MonsterConfigIds)
                        {
                            float score = scoreMap.TryGetValue(configId, out var sc) ? sc.OverallScore : avgScore;
                            // 根据怪物难度缩放存活时间：难的怪活得久
                            float killTime = avgScore > 0
                                ? baseKillTime * Math.Max(score / avgScore, 0.3f)
                                : baseKillTime;
                            killTime = Math.Min(killTime, monsterLifetimeSec);

                            if (t < evt.TimeSeconds + killTime)
                            {
                                aliveCount++;
                                aliveDiff += score;
                            }
                        }
                    }

                    // 预设怪物
                    if (t >= 0)
                    {
                        foreach (var preset in level.presetMonsters)
                        {
                            if (preset.monsterIds == null) continue;
                            foreach (var idStr in preset.monsterIds)
                            {
                                if (!int.TryParse(idStr, out int configId)) continue;
                                float score = scoreMap.TryGetValue(configId, out var sc) ? sc.OverallScore : avgScore;
                                float killTime = avgScore > 0
                                    ? baseKillTime * Math.Max(score / avgScore, 0.3f)
                                    : baseKillTime;
                                killTime = Math.Min(killTime, monsterLifetimeSec);
                                if (t < killTime)
                                {
                                    aliveCount++;
                                    aliveDiff += score;
                                }
                            }
                        }
                    }

                    accelCurve.Add(new DifficultyPoint
                    {
                        TimeSeconds = (float)Math.Round(t, 1),
                        Difficulty = (float)Math.Round(aliveDiff, 2),
                        AliveCount = aliveCount,
                    });
                    if (aliveDiff > accelPeak) accelPeak = aliveDiff;
                }

                metrics.AcceleratedCurve = accelCurve;
                metrics.DifficultyElasticity = peakDiff > 0 ? accelPeak / peakDiff : 1f;
            }

            return metrics;
        }

        /// <summary>
        /// 批量计算所有关卡
        /// </summary>
        public static List<LevelMetrics> CalculateAll(
            IReadOnlyList<LevelStructure> levels,
            IReadOnlyList<EntityScore> scores,
            IReadOnlyList<(int configId, int foeType)> foeTypes,
            float monsterLifetimeSec = DefaultMonsterLifetimeSec,
            IFoeDataProvider? provider = null)
        {
            var scoreMap = new Dictionary<int, EntityScore>();
            foreach (var s in scores)
                scoreMap[s.ConfigId] = s;

            var foeTypeMap = new Dictionary<int, int>();
            foreach (var (configId, foeType) in foeTypes)
                foeTypeMap[configId] = foeType;

            return levels
                .Select(l => Calculate(l, scoreMap, foeTypeMap, monsterLifetimeSec, provider))
                .ToList();
        }

        /// <summary>
        /// 构建 configId → 主要输出元素 缓存。
        /// 逻辑：取怪物所有攻击技能的所有打击点，统计各元素出现次数，取最多的。
        /// </summary>
        private static Dictionary<int, string> BuildElementCache(
            IEnumerable<int> configIds,
            IFoeDataProvider? provider)
        {
            var cache = new Dictionary<int, string>();
            if (provider == null) return cache;

            foreach (int configId in configIds)
            {
                if (!provider.TryGetFoeRow(configId, out var row)) continue;

                var allSkillIds = new List<int>(row.AttackSkillIds ?? new List<int>());
                if (row.NorAttackSkillId > 0 && !allSkillIds.Contains(row.NorAttackSkillId))
                    allSkillIds.Add(row.NorAttackSkillId);

                var elementCounts = new Dictionary<int, int>();
                foreach (int skillId in allSkillIds)
                {
                    var bp = provider.GetSkillBlueprint(skillId);
                    if (bp?.HitPoints == null) continue;
                    foreach (var hp in bp.HitPoints)
                    {
                        elementCounts.TryGetValue(hp.DamageElement, out int cnt);
                        elementCounts[hp.DamageElement] = cnt + 1;
                    }
                }

                if (elementCounts.Count == 0) continue;

                int dominantElement = elementCounts.OrderByDescending(kv => kv.Value).First().Key;
                cache[configId] = ElementNames.TryGetValue(dominantElement, out var name) ? name : "physics";
            }

            return cache;
        }

        // ─── 内部辅助 ──────────────────────────────────────

        private struct SpawnEvent
        {
            public float TimeSeconds;
            public List<int> MonsterConfigIds;
        }

        /// <summary>
        /// 从关卡结构中收集所有刷怪事件（触发器波次 → 时间点 + 怪物列表）
        /// </summary>
        private static List<SpawnEvent> CollectSpawnEvents(LevelStructure level)
        {
            var events = new List<SpawnEvent>();

            foreach (var trigger in level.triggers)
            {
                // 优先使用 timeline（更精确），否则从 waves 生成
                if (trigger.timeline != null && trigger.timeline.Count > 0)
                {
                    foreach (var frame in trigger.timeline)
                    {
                        var ids = new List<int>();
                        if (frame.monsterIds != null)
                        {
                            foreach (var idStr in frame.monsterIds)
                                if (int.TryParse(idStr, out int id))
                                    ids.Add(id);
                        }
                        if (ids.Count > 0)
                        {
                            events.Add(new SpawnEvent
                            {
                                TimeSeconds = level.frameRate > 0
                                    ? (float)frame.frame / level.frameRate
                                    : frame.frame / 10f,
                                MonsterConfigIds = ids,
                            });
                        }
                    }
                }
                else if (trigger.waves != null)
                {
                    foreach (var wave in trigger.waves)
                    {
                        var ids = new List<int>();
                        foreach (var m in wave.monsters)
                            for (int i = 0; i < m.count; i++)
                                ids.Add(m.configId);

                        if (ids.Count > 0)
                        {
                            events.Add(new SpawnEvent
                            {
                                TimeSeconds = wave.delayMs / 1000f,
                                MonsterConfigIds = ids,
                            });
                        }
                    }
                }
            }

            return events.OrderBy(e => e.TimeSeconds).ToList();
        }
    }
}
