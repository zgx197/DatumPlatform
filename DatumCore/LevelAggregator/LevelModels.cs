using System;
using System.Collections.Generic;

namespace Datum.Core.LevelAggregator
{
    /// <summary>
    /// 关卡结构数据（从 Unity 导出的 level_structure.json 反序列化）
    /// </summary>
    [Serializable]
    public class LevelStructure
    {
        public int levelId { get; set; }
        public string levelName { get; set; } = "";
        public string exportTime { get; set; } = "";
        public int frameRate { get; set; } = 10;
        public List<TriggerData> triggers { get; set; } = new();
        public List<PresetMonsterData> presetMonsters { get; set; } = new();
    }

    [Serializable]
    public class TriggerData
    {
        public int triggerId { get; set; }
        public int regionId { get; set; }
        public int barriesId { get; set; }
        public Vec3 position { get; set; } = new();
        public int behaviorType { get; set; }
        public float healthCoefficient { get; set; } = 1f;
        public List<WaveData> waves { get; set; } = new();
        public List<TimelineFrame> timeline { get; set; } = new();
    }

    [Serializable]
    public class WaveData
    {
        public int waveIndex { get; set; }
        public int delayMs { get; set; }
        public List<MonsterInWave> monsters { get; set; } = new();
    }

    [Serializable]
    public class MonsterInWave
    {
        public int configId { get; set; }
        public int count { get; set; }
    }

    [Serializable]
    public class TimelineFrame
    {
        public int frame { get; set; }
        public string[] monsterIds { get; set; } = Array.Empty<string>();
    }

    [Serializable]
    public class PresetMonsterData
    {
        public int triggerId { get; set; }
        public string[] monsterIds { get; set; } = Array.Empty<string>();
        public Vec3[] positions { get; set; } = Array.Empty<Vec3>();
        public Vec3[] rotations { get; set; } = Array.Empty<Vec3>();
    }

    [Serializable]
    public class Vec3
    {
        public float x { get; set; }
        public float y { get; set; }
        public float z { get; set; }
    }

    // ─── 聚合计算结果 ──────────────────────────────────────

    /// <summary>
    /// 关卡聚合指标
    /// </summary>
    public class LevelMetrics
    {
        public int LevelId { get; set; }
        public string LevelName { get; set; } = "";
        public int TotalMonsterCount { get; set; }
        public int WaveCount { get; set; }
        public float TotalDifficulty { get; set; }
        public float PeakSimultaneousDifficulty { get; set; }
        public float AverageDifficultyDensity { get; set; }
        public float DurationSeconds { get; set; }

        /// <summary> 难度曲线（按秒采样，理论模型：不考虑加速） </summary>
        public List<DifficultyPoint> DifficultyCurve { get; set; } = new();

        /// <summary> 加速曲线（按秒采样，假设玩家以固定速度击杀怪物） </summary>
        public List<DifficultyPoint> AcceleratedCurve { get; set; } = new();

        /// <summary> 难度弹性（加速后峰值 / 理论峰值，<1 说明加速有效降低了峰值压力） </summary>
        public float DifficultyElasticity { get; set; }

        /// <summary> 怪物类型分布 </summary>
        public Dictionary<string, int> MonsterTypeDistribution { get; set; } = new();

        /// <summary> 元素分布 </summary>
        public Dictionary<string, int> ElementDistribution { get; set; } = new();

        /// <summary> 每个波次的详情 </summary>
        public List<WaveMetrics> WaveDetails { get; set; } = new();
    }

    public class DifficultyPoint
    {
        public float TimeSeconds { get; set; }
        public float Difficulty { get; set; }
        public int AliveCount { get; set; }
    }

    public class WaveMetrics
    {
        public int TriggerId { get; set; }
        public int RegionId { get; set; }
        public int WaveIndex { get; set; }
        public float DelaySeconds { get; set; }
        public int MonsterCount { get; set; }
        public float WaveDifficulty { get; set; }
        public List<MonsterInWave> Monsters { get; set; } = new();
    }
}
