# Datum — 游戏数值评估框架 设计文档

> **Datum**（测量学术语：基准面）  
> 一套为游戏数值提供客观参照基准的评估框架，支持新角色/怪物数值设计验证、关卡难度曲线评估与数值平衡迭代。

---

## 1. 背景与问题定义

### 1.1 现有数值系统架构

游戏中的数值体系分为两条数据流：

**怪物数值流：**
```
MazeTriggerBrushFoeV8（刷怪配置表）
  → SpawnSchedulerSystem（波次调度） → SpawnExecutionSystem（执行刷怪）
    → MonsterBuildInfo → MonsterEnityBuildSystem.CreateMonster()
      → HRMazeFoeV8Row（怪物配置表） → MonsterDataComponent
      → AttributeComponent.BaseAttributes（攻防血写入，可被 Attr_coefficient 缩放）
      → Buff触发 → AttrExecutorSystem → AttributeComponent.DynamicAttributes
```

> 注：时间线驱动刷怪系统（`PathBasedSpawnSystem`）目前为实验性质，暂不纳入 Datum 评估范围。

**玩家数值流：**
```
客户端计算 → MainPlayerAttributeCommand → HRPlayerAttrSystem
  → AttributeComponent.BaseAttributes（整体清空重写）
  → Buff触发 → AttrExecutorSystem → AttributeComponent.DynamicAttributes
```

**核心组件：**

| 组件/文件 | 职责 |
|---|---|
| `AttributeComponent` | 核心属性容器，`BaseAttributes` + `DynamicAttributes` 两层字典 |
| `MazeAiAttrType` | 属性枚举，约 200+ 条，覆盖攻防血/元素/暴击/闪避/格挡/穿透/技能系数等 |
| `MonsterDataComponent` | 怪物原始配置快照（攻/防/血/韧性/元素抗性/类型等）|
| `AttrExecutorSystem` | Buff 修改器叠算，更新 `DynamicAttributes` |
| `HumanRobotDamageCalculationSystem` | 完整伤害计算链 |
| `HRPlayerAttrSystem` | 接收并写入玩家属性命令 |

**核心伤害公式（已有）：**
```
最终攻击 = max((面板攻 + 攻调整固定) × (1 + 攻调整百分比), 面板攻 × 0.2)
物理基础伤害 = if穿透 → 最终攻击; else → max(最终攻 - 最终防, 最终攻 × 0.1)
最终伤害 = (元素伤 × 技能系数 + 技能固定) × 动作系数 + 追加伤
           × max(1 + 增伤A - 减伤A, 0.2)
           × 暴击系数 × 格挡系数
```

**攻击频率与技能相关配置：**
- `HRMazeFoeV8Row.Attack_speed_pro` — 攻击速度（万分比），**仅影响动画播放速度（View 层），不影响逻辑层帧推进**
- `HRMazeSkillInfoV8Row.Skill_cool_time` — 技能冷却时间（毫秒，按等级的 `IntIntPair[]`）
- `HRMazeSkillInfoV8Row.Damage_rate` — 技能伤害倍率（配置表层面）
- `SkillConfigAsset.ContinuousFrames` — 技能实际持续帧数（逻辑层真实时长）
- `SkillSingleAttackAbilityConfig.DamageBaseValuePer` — 每个打击点的伤害基准系数（万分比）
- `SkillSingleAttackAbilityConfig.CanAirborne/CanKnockDown/CanStiffness/PoiseDamage` — 控制能力字段

---

### 1.2 核心问题：数值"离散性"

现有数值体系存在三个根本性问题：

**问题一：属性之间没有内在关联**  
怪物 A（Attack=500, HP=3000, Defence=200）和怪物 B（Attack=800, HP=1500, Defence=100）谁更难？表格数据本身无法回答。没有一个公式能把这些孤立数值收敛成可比较的量。

**问题二：缺少"强度维度"**  
难度是相对的。现有的 `FoeForce/Kongfu` 字段实际上是关卡进度门槛系统（`passValue >= monsterV` 用于开门/触发机关），与战斗强度无关，无法复用。

**问题三：没有属性成长曲线**  
怪物有 `Level` 字段，但各属性值是策划独立填写的绝对值，没有 `f(level) = 预期攻击值` 这样的参考曲线。跨等级的数值合理性无法验证。

---

## 2. 核心设计思想

### 2.1 解耦：以"客观物体"为共同参照

**关键洞见：** 不需要定义"标准玩家"。玩家和怪物都参考同一个"客观物体"（基准参照物），评分独立生成，最终在同一坐标系下比较。

```
玩家属性 ──→ f(玩家, 客观物体) ──→ 玩家强度评分 S_player
怪物属性 ──→ g(怪物, 客观物体) ──→ 怪物强度评分 S_monster
                                    ↓
难度 = h(S_player, S_monster)   ← 两个评分在同一坐标系下比较
```

**"客观物体"的具体形态：**  
一组固定的基准参数 `(A₀, D₀, HP₀)`，代表"最基础的一个战斗单元"。采用**纯数学归一化**（方式二），任意设定绝对值（如 `A₀=1000, D₀=500`），所有评分都是相对于这组基准的倍率。

`A₀, D₀` 对应**属性折算层输出的最终有效值**（即经过 Base + Add + AddRatio 三桶折算后的结果），而非表格原始值，确保评估与实际战斗保持一致。

---

### 2.2 双评估器架构

借鉴机器学习中 Actor-Critic 的思想：

```
┌─────────────────────────────────────────────────┐
│  Fast Evaluator（快速估算器）                    │
│  解析公式 → 毫秒级，用于 Editor 实时显示          │
│  输出：近似评分 ± 误差范围                        │
└────────────────────┬────────────────────────────┘
                     │  定期触发 / 手动触发
                     ↓
┌─────────────────────────────────────────────────┐
│  Slow Evaluator（精确仿真器）                    │
│  帧同步战斗仿真 × N 轮（蒙特卡洛）               │
│  输出：TTK/TTS 统计分布（含方差）                 │
└────────────────────┬────────────────────────────┘
                     │
                     ↓
              Weight Calibrator
              线性回归 → 更新权重配置
```

---

### 2.3 关键数学建模/ML 概念

**概念一：加权几何平均（优于算术平均）**

算术平均有"高分弥补低分"的致命缺陷（攻击=0的稻草人总分仍然很高）。  
加权几何平均实现了**短板效应**：任一维度极低，总分趋近于零。  
这与原神伤害公式各乘法区独立相乘的原理一致。

```
Score = EHP_norm^w₁ × DPS_norm^w₂ × Control_norm^w₃
```

扩展版：**α次幂平均（Power Mean）**，通过调整 α 控制短板惩罚力度：
- α=1 → 算术平均（无短板惩罚）
- α→0 → 几何平均（中等短板惩罚）
- α=-1 → 调和平均（强短板惩罚）

**概念二：蒙特卡洛仿真处理随机性**

战斗存在大量概率事件（暴击、闪避）。与其建立越来越复杂的解析期望公式，不如直接模拟 N 次取统计分布：

```
SimulationResult {
    TTK_mean, TTK_p50, TTK_p95, TTK_stddev
}
```

评分不是一个点，而是一个分布，体现"不确定性"（运气好轻松，运气差很难）。

**概念三：权重自动校准（线性回归）**

将权重调整从主观感受变为有客观损失函数的优化问题：
```
Loss = Σ (w₁×EHP_i + w₂×DPS_i + w₃×Control_i - SimulatedTTK_i)²
最小化 Loss → 自动求解最优 w₁, w₂, w₃
```

**概念四：灵敏度分析**

对每只怪物计算偏导数，回答"这只Boss的难度主要来自哪里"：
```
∂Score/∂Attack, ∂Score/∂Defence, ∂Score/∂HpMax
```

**概念五：置信区间**

评分附带误差范围，反映 buff/装备不确定性时的难度波动区间。

---

## 3. 系统架构：六层评估管线

```
原始数据源
(表格行 / EntityRef / 自定义字典)
      ↓
┌──────────────────────────────────────────────────────┐
│  Layer 0: 数据快照层 (Snapshot Builder)               │
│  统一数据来源，输出 AttributeSnapshot（纯数据DTO）     │
└──────────────────────────────────────────────────────┘
      ↓  可注入：EquipmentModifier / BuffModifier / MechanicTagModifier
┌──────────────────────────────────────────────────────┐
│  Layer 1: 属性折算层 (Attribute Resolver)             │
│  共用 AttributeFormulas 工具类，折算最终有效属性       │
└──────────────────────────────────────────────────────┘
      ↓  参数：A₀, D₀（基准参照物，来自 EvaluationConfig）
┌──────────────────────────────────────────────────────┐
│  Layer 2: 战斗指标层 (Combat Metrics)                 │
│  计算 EHP、期望 DPS、暴击期望等客观战斗指标            │
└──────────────────────────────────────────────────────┘
      ↓  参数：技能配置表（第一版简化为固定系数）
┌──────────────────────────────────────────────────────┐
│  Layer 3: 技能评估层 (Skill Evaluator)                │
│  从技能表读取冷却和伤害倍率，修正 DPS 计算             │
│  第一版：攻击频率 = 1/s，伤害系数 = 1.0               │
└──────────────────────────────────────────────────────┘
      ↓  参数：权重配置（策划通过 ScriptableObject 调整）
┌──────────────────────────────────────────────────────┐
│  Layer 4: 综合评分层 (Score Aggregator)               │
│  多维指标 → 单一评分（几何平均），附带分项贡献说明     │
└──────────────────────────────────────────────────────┘
      ↓
┌──────────────────────────────────────────────────────┐
│  Layer 5: 难度分析层（已移入 Workbench Tab④/⑤）       │
│  单体难度 → 区域难度 → 关卡难度曲线                   │
└──────────────────────────────────────────────────────┘
```

### Modifier 注入机制

装备/Buff/特殊机制统一通过 `IAttributeModifier` 接口注入，在 Layer 0→1 之间处理：

```csharp
interface IAttributeModifier {
    void Apply(AttributeSnapshot snapshot);
}
// 具体实现：EquipmentSetModifier, PermanentBuffModifier, SpecialMechanicModifier
```

---

## 4. 关键数据结构

### AttributeSnapshot（Layer 0 输出）
```
AttributeSnapshot {
    RawAttributes: Dictionary<MazeAiAttrType, float>  // 原始属性值
    Source: SnapshotSource   // FromTable / FromEntity / FromCustom
    Metadata: { Level, FoeType, SkillIds, Name }
}
```

### CombatMetrics（Layer 2 输出）
```
CombatMetrics {
    EHP: float             // 有效生命值（面对 A₀ 的生存能力）
    DPS_expected: float    // 期望 DPS（对 D₀，含暴击期望）
    BurstDmg: float        // 单次最大伤害
    TTK_vs_baseline: float // 对基准目标的击杀时间
    TTS_vs_baseline: float // 面对基准攻击者的生存时间
}
```

### EntityScore（Layer 4 输出）
```
EntityScore {
    OverallScore: float              // 综合评分
    SurvivalContribution: float      // 生存分贡献
    DamageContribution: float        // 输出分贡献
    ControlContribution: float       // 控制分贡献
    DiagnosticNotes: string[]        // "防御极高，大幅提升 EHP" 等
}
```

### EvaluationWeightConfig（ScriptableObject）
```
EvaluationWeightConfig {
    A₀: float = 1000        // 基准攻击力
    D₀: float = 500         // 基准防御力
    HP₀: float = 5000       // 基准生命值
    SurvivalWeight: float = 0.4
    DamageWeight:   float = 0.4
    ControlWeight:  float = 0.2
    PowerMeanAlpha: float = 0.0  // 0=几何平均，1=算术平均
    FoeTypeBonus: { Normal:1.0, Elite:1.3, Boss:2.0 }
}
```

---

## 5. 三阶段演进路线

| 阶段 | 特征维度 | 聚合方式 | 权重来源 | 目标 |
|---|---|---|---|---|
| **第一版（已完成）** | EHP + DPS（固定攻击频率） | 加权算术平均 | 人工设定 | 跑通 Editor，能看到难度曲线 |
| **第二版（已完成）** | + 技能DPS + 控制双侧量化 + 玩家基准 | Power Mean（α参数） | 人工设定 + 玩家基准对比 | 评分与实际战斗体验建立关联 |
| **第三版（规划中）** | + Buff/装备 + 元素维度 + 蒙特卡洛 | Power Mean + 仿真校准 | 半自动校准 | 支持复杂场景全量评估 |

---

## 6. 第一版实际完成内容（v1.0）

### 6.1 已实现功能

| 模块 | 实现情况 |
|---|---|
| Layer 0 `MonsterSnapshotBuilder` | 从 `HRMazeFoeV8Row` 构建快照，读取攻/防/血/韧性/元素抗性/攻速，记录 `BarriesId` |
| Layer 1 `AttributeResolver` | 折算最终攻/防/血，`AttributeFormulas` 提供公式工具类 |
| Layer 2 `CombatMetricsCalculator` | 计算 `EHP`、期望 `DPS`（`Attack_speed_pro` 折算攻击频率，暴击期望公式） |
| Layer 4 `ScoreAggregator` | 加权算术平均，输出 `OverallScore`、分项贡献、诊断说明 |
| Layer 5 `DifficultyAnalyzer` | 聚合单体评分生成关卡报告（均值、峰值、区域分布）—— **已删除，功能迁移至 Workbench Tab④/⑤** |
| Editor UI `DatumMainWindow` | 菜单 `Datum/Open Datum` —— **已改为快捷入口，功能迁移至 Datum Workbench** |

### 6.2 Editor UI 功能清单

- **关卡下拉**：从 `MazeFoeV8.In_barries_id` 建立映射，按关卡独立浏览，显示 `[ID] Lv.N (N只)` 格式
- **怪物列表**：按属性特征键（名称+类型+等级+EHP+DPS）聚合去重，数量列橙色高亮 `×N`
- **难度条**：对数刻度显示，有效解决长尾数据可视化问题
- **分项明细**：点击怪物行查看 EHP/DPS/Control 各维度归一化倍率和诊断说明
- **柱状图**：同样使用对数刻度，支持横向滚动
- **权重配置**：`EvaluationWeightConfig` ScriptableObject，支持 Inspector 调整后实时重算

### 6.3 已知问题与局限

- **攻击速度折算粗糙**：`Attack_speed_pro` 为万分比附加值，基础攻速未准确建模，实际 DPS 偏低
- **技能冷却未接入**：Layer 3 `SkillEvaluator` 未实现，DPS 仅基于普攻频率
- **元素维度未计入**：元素抗性/元素攻击未纳入 DPS 计算
- **控制分维度意义不清**：`ToughMax`（韧性上限）≠ 控制能力，需重新定义
- **评分绝对值无参考意义**：当前评分是相对值，缺少与玩家强度的对比维度
- **基准值需人工标定**：`BaselineAtk/Def/HP/Control` 均为静态配置，未自动校准

---

## 7. 目录结构

```
Assets/Editor/Datum/
    Core/
        Snapshot/          # Layer 0: AttributeSnapshot, MonsterSnapshotBuilder
        Resolver/          # Layer 1: AttributeFormulas, AttributeResolver
        Metrics/           # Layer 2: CombatMetrics, CombatMetricsCalculator
        SkillEvaluator/    # Layer 3: SkillEvaluator, SkillEvaluationResult
        Aggregator/        # Layer 4: EntityScore, ScoreAggregator
        Calibrator/        # WeightCalibrator（最小二乘法权重校准）
        Template/          # TemplateDiscovery + TemplateEvaluator（模板发现与评估）
        DatumContext.cs    # 统一工作台共享上下文 + 权重变更追踪
    Windows/
        DatumWorkbench.cs          # 统一工作台主框架（5 Tab + 状态栏 + 跨 Tab 联动）
        DatumWorkbench.Tab1~5.cs   # 各 Tab 的 partial class
        TemplateWindow.cs          # 快捷入口 → Tab①
        CalibrationWindow.cs       # 快捷入口 → Tab③（保留 AddSampleFromMainWindow）
        DatumMainWindow.cs         # 快捷入口 → Tab④
    Config/
        EvaluationWeightConfig.cs/.asset  # 权重配置
        CalibrationData.cs/.asset         # 校准样本数据
        MonsterTemplateRegistry.cs/.asset # 怪物模板注册表
        CreateAsset.cs                    # ScriptableObject 创建菜单
    Documentations~/       # 设计文档（Unity 不导入）
```

---

## 8. 第二版实现内容（v2.0，已完成）

> 目标：评分与实际战斗体验建立真实关联，减少人工标定。

### 8.1 Layer 3 技能 DPS（双数据源）

v1 的 DPS 仅用 `Attack_speed_pro` 粗估，v2 从**双数据源**读取技能数据，实现了完整的技能评估。

**数据源 A — 配置表（`HRMazeSkillInfoV8Row`）：**
- `Skill_cool_time`：冷却时间（毫秒，`IntIntPair[]` 取首条 `.Value`）

**数据源 B — 技能蓝图资产（`SkillConfigAsset`）：**
- `ContinuousFrames`：技能持续逻辑帧数
- 通过公开 API `GetAllLogicAbilities()` 遍历所有逻辑层能力：
  - `SkillSingleAttackAbilityConfig.DamageBaseValuePer`（伤害基准万分比）
  - `SkillSingleAttackAbilityConfig.CanAirborne/CanKnockDown/CanStiffness`（控制标志）
  - `SkillSingleAttackAbilityConfig.PoiseDamage`（躯干值削减）
  - `SkillContinuousAttackAbilityConfig.MainTargetDamageValues`（连续伤害值列表）

**帧率参数：** `UpdateFPS = 10`（来自 `HumanRobotSessionConfig.asset`）

> `Attack_speed_pro` 仅影响动画播放速度，不影响逻辑帧推进，v2 的 DPS 计算不再使用此字段。

**DPS 计算公式（单技能）：**
```
skill_total_damage_per = Σ(每个打击点的 DamageBaseValuePer)
skill_cycle_time = max(ContinuousFrames / 10, Skill_cool_time / 1000)
skill_dps = base_attack × (skill_total_damage_per / 10000) / skill_cycle_time
```

**多技能期望 DPS：**
- 技能列表来自 `HRMazeFoeV8Row.Attack_skill_id`（主动技能）+ `Nor_attack_skill_id`（普攻）
- 有 `CastPriority` 时按优先级加权，否则按等概率轮转
- 无蓝图资产的技能自动回退为 `base_attack / cycle_time`

**SkillConfigAsset 缓存机制：**
- 首次评估时通过 `AssetDatabase.FindAssets("t:SkillConfigAsset")` 查找所有蓝图
- 按 `SkillID` 建立 `Dictionary<int, SkillConfigAsset>` 缓存
- `RoleID=0` 的通用配置优先，跳过 `IsOldSkill` 标记的旧技能
- "重新加载表格"时调用 `SkillEvaluator.ClearCache()` 清除缓存

### 8.2 控制维度双侧量化

**进攻侧 — 控制输出（`ControlOutputScore`）：**
- 从每个技能的打击点提取控制标志（`CanAirborne / CanKnockDown / CanStiffness`）
- `ControlCoverage = 控制打击点数 / 总打击点数`（跨所有技能）
- 归一化基准：`CONTROL_OUTPUT_BASELINE = 0.3`（覆盖率 30% 时归一化为 1.0）

**防御侧 — 控制抗性（`ControlResistanceScore`）：**
- `ToughMax / 5000` 和 `PoiseValue / 3000` 取最大值
- 目前 `PoiseValue` 来源未确定（`MazeFoeV8` 中无此字段），默认为 0

**综合控制分：**
```
ControlScore = 0.6 × ControlOutputScore + 0.4 × ControlResistanceScore
```

### 8.3 Power Mean 聚合（替代算术平均）

`ScoreAggregator` 支持通过 `EvaluationWeightConfig.PowerMeanAlpha` 控制聚合方式：

| α 值 | 聚合方式 | 特性 |
|---|---|---|
| 1.0 | 加权算术平均 | v1 兼容，无短板惩罚 |
| 0.0（默认） | 加权几何平均 | 中等短板效应（任一维度为 0 → 总分为 0） |
| -1.0 | 加权调和平均 | 强短板惩罚 |

**数学公式：**
```
α ≈ 0: Score = exp(Σ wi×ln(vi) / Σwi)     — 几何平均
α ≠ 0: Score = (Σ wi×vi^α / Σwi)^(1/α)    — 通用 Power Mean
```

### 8.4 玩家基准接入

`EvaluationWeightConfig` 新增字段：
- `PlayerBaseAtk / PlayerBaseDef / PlayerBaseHP` — 标准玩家属性
- `EnablePlayerBaseline` — 开关

开启后 `ScoreAggregator` 额外计算：
- `Player_score`：用同一套公式和 Power Mean 聚合计算玩家评分
- `Relative_diff = Monster_score / Player_score`：相对难度倍率

> 当前仅支持单套玩家属性配置，不接装备系统数据。

### 8.5 UI 更新

详情面板新增：
- **控制指标区**：控制输出分 / 控制抗性分 / 综合控制分
- **技能评估明细**：已解析/总数、期望 DPS、控制覆盖率、躯干削减/秒
- **每个技能子项**：技能名(ID)、DPS、打击数、控制打击数、CD 时长、是否有蓝图

诊断说明新增：
- 技能蓝图缺失警告（全部缺失 → v1 回退提示，部分缺失 → DPS 可能偏低提示）
- 高控制覆盖率标记（>50% 标注为高控制型怪物）

### 8.6 已知问题与后续

| 问题 | 说明 |
|---|---|
| PoiseValue 来源未确定 | `MazeFoeV8` 表无此字段，`MonsterDataComponent.PoiseValue` 来源待查 |
| 元素维度未纳入 DPS | 元素攻击/元素抗性未影响伤害计算 |
| Buff 控制未计入 | `SkillAddBuffAbilityConfig` 附带的控制 Buff 未读取 |
| 权重校准仍为人工 | P2 校准向导未实现 |
| 蒙特卡洛仿真未实现 | P3 延至第三版 |
| α=0 几何平均的零值问题 | 控制分为 0 的怪物总分直接归零，可能需要 clamp 下限 |

### 8.7 修改文件清单

| 文件 | 变更 |
|---|---|
| **新增** `SkillEvaluator.cs` | Layer 3 核心评估器（缓存 + 双数据源 + 多技能聚合） |
| **新增** `SkillEvaluationResult.cs` | 技能评估结果数据结构（SkillBreakdown + SkillEvaluationResult） |
| `AttributeSnapshot.cs` | `SnapshotMetadata` 新增 `AttackSkillIds`, `PoiseValue` |
| `MonsterSnapshotBuilder.cs` | 读取 `Attack_skill_id` 到 metadata |
| `CombatMetrics.cs` | 新增 `ControlOutputScore`, `ControlResistanceScore`, `SkillResult` |
| `CombatMetricsCalculator.cs` | 重写：接入技能 DPS + 双侧控制量化 + v1 回退 |
| `ScoreAggregator.cs` | Power Mean 聚合 + 玩家基准相对难度 + 技能诊断 |
| `EvaluationWeightConfig.cs` | 新增 `PowerMeanAlpha`, `PlayerBaseAtk/Def/HP`, `EnablePlayerBaseline` |
| `DatumMainWindow.cs` | `RecalculateAll` 接入 Layer 3，详情面板新增技能明细和控制指标 |

---

## 9. 第三版设计（v3.0，规划中）

> 目标：支持复杂场景全量评估，半自动权重校准，提供精确的统计置信区间。

### 9.0 已完成：权重半自动校准 + UX 优化

**新增文件：**

| 文件 | 职责 |
|---|---|
| `Config/CalibrationData.cs` | 校准样本数据结构（`CalibrationSample` + `CalibrationResult` + `CalibrationData` ScriptableObject） |
| `Core/Calibrator/WeightCalibrator.cs` | 最小二乘法求解器（正规方程 + 非负约束 + 归一化 + 缩放因子） |
| `Windows/CalibrationWindow.cs` | 校准向导 Editor 窗口（v2 UX 优化版） |

**修改的文件：**

| 文件 | 变更 |
|---|---|
| `Windows/DatumMainWindow.cs` | 详情面板底部新增"添加到校准样本"按钮（主窗口联动） |

**数学模型：**
```
PredictedScore_i = scale × (w₁×EHP_norm_i + w₂×DPS_norm_i + w₃×Control_norm_i)
Loss = Σ (PredictedScore_i - SubjectiveScore_i)²
求解：w = (XᵀX)⁻¹ Xᵀy（正规方程，3×3 克拉默法则）
约束：wi ≥ 0，归一化 w₁+w₂+w₃=1
```

**菜单入口：** `Datum / Weight Calibrator`

**UX 功能清单：**

| 优先级 | 功能 | 说明 |
|---|---|---|
| P0 | 搜索框 + 类型过滤 | 按名称/ID 模糊搜索，按 FoeType 下拉过滤，搜索结果实时预览（最多 8 条） |
| P0 | 自动抽样 | 按 FoeType 分层随机抽样，每类 2~3 个，一键填充样本 |
| P0 | 从主窗口添加 | Datum 主窗口详情面板底部"添加到校准样本"按钮，直接联动 |
| P0 | 散点图 | 校准后显示"主观评分 vs 预测评分"散点图，对角线为理想拟合线，锚点参考线，误差着色 |
| P0 | 残差高亮 | 样本列表中预测误差按阈值着色（绿<0.8，黄<1.5，红>1.5），散点图点大小随误差增大 |
| P1 | 评分锚点 | 滑块上叠加难度锚点标记（简单=2 绿，中等=5 黄，困难=8 红），列表上方显示锚点标签 |
| P1 | 异常检测 | 校准时自动检测"三维属性均高但主观分反低"的矛盾标注，弹出警告 |
| P2 | 权重对比 | 校准结果同时显示新旧权重条形图对比，带 diff 值着色 |
| P2 | 一键回退 | "回退上次权重"按钮，保存应用前的权重快照 |
| P2 | 主窗口联动 | `CalibrationWindow.AddSampleFromMainWindow()` 静态接口 |
| P3 | 排序模式 | 切换后显示上下移动按钮和排名序号，"自动分配分数"按排列顺序线性映射 1~10 |
| P3 | 清空全部 | 带确认对话框的批量清除 |

**工作流程：**
1. 搜索添加或自动抽样选择代表性怪物（建议 8~15 个，覆盖小怪/精英/Boss）
2. 标注模式：参考锚点（简单/中等/困难）设定主观难度；或排序模式：拖拽排列后自动分配分数
3. 点击"执行校准"，系统自动计算归一化值、检测标注异常、求解最优权重
4. 预览散点图和权重对比，确认拟合质量（R²/RMSE + 自然语言解释）
5. 一键应用到 `EvaluationWeightConfig`（支持 Undo + 一键回退）

### 9.0.1 已完成：怪物模板系统（半自动发现 + 属性缩放）

#### 问题背景

当前配置表 `HRMazeFoeV8Row` 中，同一种怪物在不同关卡会重复配置为多条记录，每条记录有独立的绝对属性值。这导致：
- 校准向导中需要逐个标注，实际上很多是"同种怪物的不同等级版本"
- 无法看出属性的增长规律和异常配置
- 难以做跨关卡的横向对比

#### 设计目标

- 自动发现"同种怪物"（按 `Model_id + Foe_type + 技能集` 聚类）
- 计算属性缩放系数（以最低等级版本为基准）
- 策划确认/调整自动发现结果
- 与校准向导和评估管线集成

#### 核心数据结构

```
MonsterTemplateRegistry (ScriptableObject)
├── Templates: List<MonsterTemplate>
│   ├── TemplateId: string          // 自动生成或策划命名
│   ├── DisplayName: string         // 显示名称
│   ├── BaseConfigId: int           // 基准怪物的 ConfigId（最低等级）
│   ├── ModelId: int                // 共享的 Model_id
│   ├── FoeType: int                // 共享的 Foe_type
│   ├── BaseSkillIds: int[]         // 共享的技能集
│   ├── Confirmed: bool             // 策划是否已确认
│   └── Variants: List<TemplateVariant>
│       ├── ConfigId: int           // 该变种的 FoeRow ConfigId
│       ├── Level: int              // 等级
│       ├── BarriesId: int          // 所属关卡
│       ├── AtkScale: float         // 攻击缩放 = atk / base_atk
│       ├── DefScale: float         // 防御缩放
│       ├── HpScale: float          // 生命缩放
│       └── OverallScale: float     // 综合缩放 = (AtkScale + DefScale + HpScale) / 3
└── LastDiscoveryTime: string       // 上次自动发现时间
```

#### 自动发现算法

```
输入：所有 HRMazeFoeV8Row
1. 构建聚类 key = (Model_id, Foe_type, sorted(Attack_skill_id))
2. 按 key 分组，过滤掉只有 1 条记录的组（不需要模板化）
3. 每组内按 Level 排序，最低等级为 base
4. 计算每个变种相对 base 的缩放系数
5. 检测异常：缩放系数偏差超过阈值时标记警告
输出：List<MonsterTemplate>
```

#### 缩放系数计算

```
AtkScale = variant.Attack_max / base.Attack_max
DefScale = variant.Def_max    / base.Def_max
HpScale  = variant.Hp_max     / base.Hp_max
OverallScale = (AtkScale + DefScale + HpScale) / 3

异常检测：
- 如果三个缩放系数的变异系数 CV > 0.3，标记"非均匀缩放"警告
  （说明该变种不是简单的等比缩放，可能有手动调整）
```

#### 与校准向导的集成

- 校准向导支持"按模板标注"模式：只需标注每个模板的 base 怪物难度
- base 怪物的校准完成后，变种怪物的预测分 = base 预测分 × OverallScale
- 这大幅减少了策划标注工作量（N 个模板 vs N×M 个怪物变种）

#### 与评估管线的集成

- `DatumMainWindow` 新增"模板视图"标签页，按模板分组显示怪物
- 每个模板显示缩放曲线（等级 vs 属性），方便发现异常配置
- 支持从模板视图快速跳转到怪物详情

#### 新增文件

| 文件 | 职责 |
|---|---|
| `Config/MonsterTemplateRegistry.cs` | 模板注册表数据结构（ScriptableObject） |
| `Core/Template/TemplateDiscovery.cs` | 半自动聚类发现 + 缩放系数计算 |
| `Core/Template/TemplateEvaluator.cs` | 模板评估器（评分 + 一致性检查） |
| `Windows/TemplateWindow.cs` | ~~模板管理窗口~~ → **快捷入口**（打开 Workbench Tab①） |

#### 菜单入口

`Datum / Monster Templates`（现跳转到 Datum Workbench Tab①）

### 9.1 改进方向

#### 方向 A：元素维度纳入（补全 DPS 精度）

v2 的 DPS 是纯物理伤害，完全忽略了元素攻击/元素抗性。实际战斗中元素伤害占比不小。

实现思路：
- 从 `SkillConfigAsset` 或 `HRMazeSkillInfoV8Row` 读取技能的元素类型
- 将 `Ice_res / Fire_res / Poi_res / Ele_res`（已在 snapshot 中）纳入 DPS 修正
- 公式：`element_dps = base_dps × (1 - element_resistance / 10000)`

难点：需要确定每个技能的元素类型数据来源。

收益：中等。对纯物理怪物无影响，但对元素类怪物/Boss 评分更准确。

#### 方向 B：Buff 维度（技能附带效果）

很多怪物技能会附带 Buff（增伤/减伤/DOT/控制），v2 完全忽略了这部分。

实现思路：
- 从 `SkillAddBuffAbilityConfig` 读取技能附带的 BuffID
- 查 Buff 配置表，提取 Buff 效果类型
- 对 DPS 类 Buff（DOT、增伤）折算为额外 DPS
- 对控制类 Buff（减速、眩晕、沉默）折算为额外控制分

难点：Buff 配置表结构复杂，效果类型多样，需要逐类解析。

收益：高。对 Boss 型怪物尤其重要，因为 Boss 的难度很大程度来自 Buff 而非直接伤害。

#### 方向 C：权重半自动校准（线性回归）

三维权重（生存/输出/控制）目前纯靠策划手动设定，缺乏客观依据。

实现思路：
- 策划在 Editor 中标注若干"参考样本"（如：怪物 X 主观难度=3，怪物 Y=7）
- 用最小二乘法求解最优 `[w₁, w₂, w₃]`，使评分与主观标注的 MSE 最小
- 在 Editor 中提供"校准向导"面板（标注 → 计算 → 预览 → 应用）

难点：需要策划配合标注样本，且样本数量要足够。

收益：高。一旦校准完成，所有怪物的评分自动对齐策划感受，后续新怪物无需重新标定。

#### 方向 D：蒙特卡洛仿真（Slow Evaluator）

当前所有计算都是解析公式（Fast Evaluator），无法处理随机性（暴击、闪避、概率触发的 Buff）。

实现思路：
- 构建简化版战斗仿真器（不需要完整帧同步，只需攻防回合制模拟）
- 模拟 N 轮（如 1000 轮），统计 TTK/TTS 分布
- 输出：均值 ± 标准差、P50/P95 百分位

难点：工作量最大（1周+），需要复刻伤害公式链、暴击逻辑、闪避逻辑等。

收益：最高但最远。能处理所有随机性，提供置信区间，并可用于自动校准权重。

#### 方向 E：关卡维度聚合升级

v2 的 Layer 5 `DifficultyAnalyzer`（已删除）只是简单求和/平均，没有考虑刷怪顺序、波次结构、同时在场怪物数量。

实现思路：
- 从 `MazeTriggerBrushFoeV8` 读取波次结构（触发器 → 波次 → 怪物列表 + 间隔时间）
- 计算"同时在场难度"（同一波次的怪物评分叠加）vs"总体难度"（全关卡累加）
- 生成时间线视图：随时间推移的难度曲线

难点：刷怪系统的波次逻辑比较复杂（区域触发 + 间隔时间 + 加权随机采样）。

收益：中高。让策划看到"关卡的哪个阶段最难"，而不是只看一个聚合数字。

### 9.2 优先级排序

| 优先级 | 方向 | 工作量 | 理由 |
|---|---|---|---|
| **P0** | C：权重半自动校准 | 3天 | 低工作量高收益，直接解决"评分与感受不对齐"的核心痛点 |
| **P1** | E：关卡维度聚合升级 | 3-4天 | 从"单体评估"升级为"关卡设计辅助"，对策划价值跃升 |
| **P1** | A：元素维度 | 1-2天 | 补全 DPS 精度，工作量不大 |
| **P2** | B：Buff 维度 | 4-5天 | 重要但复杂，需要 Buff 配置表的深入分析 |
| **P3** | D：蒙特卡洛仿真 | 1周+ | 长期目标，工作量最大，需要复刻战斗逻辑 |

### 9.3 已完成：Datum Workbench 统一工作台（第二期）

> 目标：将分散的独立窗口整合为统一工作台，消除窗口间切换成本，实现跨功能联动。

#### 设计动机

v3.0 P0 阶段产生了 3 个独立 EditorWindow（TemplateWindow、CalibrationWindow、DatumMainWindow），策划需要频繁切换窗口、手动传递上下文。统一工作台将它们整合为一个窗口内的 5 个 Tab，共享 `DatumContext`。

#### Datum Workbench 架构

```
DatumWorkbench (EditorWindow, partial class)
├── DatumContext           共享上下文（TableData / WeightConfig / Registry / Calibration / AllScores）
├── Tab① 模板发现          聚类发现 + 变种列表 + 缩放曲线图
├── Tab② 模板评估          评分计算 + 一致性检查 + 趋势图
├── Tab③ 权重校准          样本管理 + 最小二乘校准 + 散点图 + 权重对比
├── Tab④ 全量评估          评分列表 + 难度分布 + 详情面板 + 关卡筛选
├── Tab⑤ 健康报告          全局概览 + 一致性汇总 + 跨模板对比 + 诊断建议
├── 底部状态栏              模板/权重/评分/一致性问题 实时状态
└── 跨 Tab 联动提示         权重变更横幅 + 评分过期提示 + 一键重算按钮
```

#### 旧窗口改为快捷入口

| 旧窗口 | 菜单 | 行为 |
|---|---|---|
| `TemplateWindow` | `Datum / Monster Templates` | `DatumWorkbench.OpenTab(0)` |
| `CalibrationWindow` | `Datum / Weight Calibrator` | `DatumWorkbench.OpenTab(2)` |
| `DatumMainWindow` | `Datum / Open Datum` | `DatumWorkbench.OpenTab(3)` |

- `CalibrationWindow.AddSampleFromMainWindow()` 静态方法保留，改为直接操作 `CalibrationData` 资产
- 旧窗口代码已全部清理（不再有 `#if` 禁用块）

#### DatumContext 权重变更追踪

```
SnapshotWeights()       — 保存当前权重快照
CheckWeightsChanged()   — 检测权重是否发生变化
OnWeightsApplied()      — 权重变更后标记 ScoresDirty + TemplateScoresDirty
```

Tab③ 权重应用/回退时自动调用 `OnWeightsApplied()`，其他 Tab 通过 `DrawCrossTabNotifications()` 显示提示横幅。

#### 跨 Tab 联动提示

| 条件 | 显示位置 | 提示内容 |
|---|---|---|
| 权重变更 | 非 Tab③ 的所有 Tab | ⚠ 黄色横幅 + 重算按钮 + 忽略按钮 |
| 模板评分过期 | Tab②/⑤ | ℹ 蓝色提示 + 计算按钮 |
| 全量评分过期 | Tab④ | ℹ 蓝色提示 + 重算按钮 |

#### Tab① 缩放曲线图

选中模板后，在变种列表下方绘制多维度折线图：
- X 轴：等级（Lv.min ~ Lv.max）
- Y 轴：缩放系数（0 ~ maxScale×1.1）
- 每个属性独立颜色，基准线 ×1.0 用半透明白线标注
- 仅绘制 BaseValues 非零的属性维度

#### 代码清理

| 操作 | 详情 |
|---|---|
| `CalibrationWindow.cs` | 40KB → 1.7KB |
| `DatumMainWindow.cs` | 32KB → 0.4KB |
| `Core/Analyzer/` | 整个目录删除（DifficultyAnalyzer + DifficultyReport） |
| README 更新 | 根目录 + Windows + Config + SkillEvaluator + Snapshot |

---

## 10. 平台化拆分讨论（v4.0 方向）

> Datum 的核心计算逻辑（评分管线、模板发现、权重校准）与 Unity 无关，
> 适合拆分为独立的可视化工具或 Web 服务，供数值策划在不打开客户端的情况下使用。

### 10.1 拆分动机

1. **策划工作流**：数值策划日常工作是在表格中调整数值，然后需要看到评估结果。当前必须打开 Unity Editor 才能使用 Datum，启动成本高、迭代慢。
2. **跨项目复用**：Datum 的评分框架（Snapshot → Resolver → Metrics → Aggregator）是通用的，其他关卡设计项目也需要类似的数值评估能力（如自动散布怪物需要知道各怪物的数值指标）。
3. **协作效率**：多人同时使用 Datum 时，Unity 工程的并发访问是个问题；Web 服务天然支持多人访问。
4. **数据驱动**：Datum 的输入本质上是配置表数据（CSV/JSON），输出是评分和报告，不依赖 Unity 运行时。

### 10.2 当前对 Unity 的依赖分析

| 依赖项 | 依赖程度 | 拆分难度 |
|---|---|---|
| `HumanRobotTableData`（配置表数据） | **核心输入** | 中 — 需要导出为通用格式（JSON/CSV） |
| `SkillConfigAsset`（技能蓝图） | 技能 DPS 计算 | 高 — 需要提取打击点数据为静态配置 |
| `ScriptableObject`（配置持久化） | 存储 | 低 — 替换为 JSON/SQLite |
| `EditorWindow` / `IMGUI`（UI） | 展示层 | 低 — 替换为 Web UI |
| `AssetDatabase`（资产加载） | 编辑器工具 | 低 — 替换为文件 IO |
| `Undo` / `EditorUtility`（编辑器功能） | 辅助 | 低 — 可选实现 |

**结论：核心计算逻辑对 Unity 零依赖，唯一的硬依赖是数据输入格式。**

### 10.3 备选方案

#### 方案 A：纯前端 Web 应用（Static SPA）

```
架构：React/Vue SPA + 本地 JSON 文件
数据流：策划导出配置表 → JSON → 拖入 Web 页面 → 前端计算 → 可视化
```

- **优点**：零后端、零部署成本，单 HTML 文件即可分发；离线可用
- **缺点**：大量 C# 逻辑需要用 TypeScript 重写；无法自动同步配置表；每次需要手动导出
- **适用场景**：小团队、快速原型

#### 方案 B：轻量后端 + Web 前端

```
架构：Python/Go 后端 API + React 前端
数据流：后端定时/手动读取配置表仓库 → 计算评分 → REST API → 前端可视化
```

- **优点**：Python 生态丰富（numpy 做数值计算、pandas 做数据处理）；支持多人访问；可集成 CI/CD 自动更新
- **缺点**：需要维护服务器；需要配置表的自动导出管道
- **适用场景**：中大团队、长期维护

#### 方案 C：C# 核心库 + 多前端

```
架构：Datum.Core（.NET Standard 类库） + Unity Editor 前端 + Web 前端（Blazor/API）
数据流：共享同一套 C# 计算逻辑，不同前端适配不同场景
```

- **优点**：核心逻辑不需要重写，Unity Editor 和 Web 共用；C# 到处运行
- **缺点**：Blazor WASM 体积较大；需要抽象数据加载层
- **适用场景**：需要同时保留 Unity Editor 内功能的项目

#### 方案 D：Electron/Tauri 桌面应用

```
架构：Tauri（Rust 后端 + Web 前端）或 Electron
数据流：直接读取本地配置表文件 → 计算 → 桌面 UI
```

- **优点**：原生文件访问能力；不需要服务器；可直接监听配置表文件变更
- **缺点**：需要分发安装包；跨平台维护成本
- **适用场景**：需要本地文件监听和离线使用的团队

### 10.4 推荐的分层拆分架构

无论选择哪个方案，都建议先做**核心逻辑拆分**：

```
┌─────────────────────────────────────────────┐
│  Datum.Core（纯计算库，无 UI 无 IO 依赖）    │
│  ├── Snapshot/     属性快照构建              │
│  ├── Resolver/     属性折算                  │
│  ├── Metrics/      战斗指标计算              │
│  ├── SkillEval/    技能评估                  │
│  ├── Aggregator/   评分聚合                  │
│  ├── Calibrator/   权重校准                  │
│  ├── Template/     模板发现 + 评估            │
│  └── Models/       数据模型（输入/输出 DTO）   │
├─────────────────────────────────────────────┤
│  Datum.IO（数据适配层）                       │
│  ├── UnityAdapter  从 Unity 资产读取          │
│  ├── JsonAdapter   从 JSON 文件读取           │
│  ├── CsvAdapter    从 CSV 文件读取            │
│  └── ExportPipeline 配置表自动导出            │
├─────────────────────────────────────────────┤
│  Datum.UI（展示层，可替换）                    │
│  ├── Unity EditorWindow（当前实现）           │
│  ├── Web SPA（React + ECharts）              │
│  └── Desktop App（Tauri / Electron）         │
└─────────────────────────────────────────────┘
```

### 10.4 已实现的分层架构（v4.0 Phase1+Phase2）

Phase1 和 Phase2 已完成实现，实际落地的架构如下：

```
┌─────────────────────────────────────────────────────┐
│  Datum.Core（纯计算层，无 UI 无 IO 依赖）             │
│  ├── Provider/     IFoeDataProvider 接口 + POCO 模型  │
│  │   ├── DatumFoeRow / DatumSkillInfoRow             │
│  │   ├── DatumSkillBlueprint / DatumHitPoint         │
│  │   └── IFoeDataProvider（GetAllFoeRows 等）        │
│  ├── Snapshot/     MonsterSnapshotBuilder.BuildFromRow│
│  ├── Resolver/     AttributeResolver                 │
│  ├── Metrics/      CombatMetricsCalculator           │
│  ├── SkillEvaluator SkillEvaluator（接受 IFoeDataProvider）│
│  ├── Aggregator/   ScoreAggregator                   │
│  ├── Calibrator/   WeightCalibrator                  │
│  └── Template/     TemplateDiscovery + TemplateEvaluator│
├─────────────────────────────────────────────────────┤
│  Datum.IO（数据适配层，已实现两个 Provider）           │
│  ├── UnityFoeDataProvider  — Unity 侧（HumanRobotTableData + SkillConfigAsset）│
│  ├── JsonFoeDataProvider   — JSON 侧（消费导出文件）  │
│  └── Export/               — DatumExportPipeline（菜单 Datum/Export Data）│
│       输出：monsters.json / skill_info.json / skill_blueprints.json│
│            weight_config.json / calibration.json    │
│            templates.json / monster_scores.json     │
├─────────────────────────────────────────────────────┤
│  Datum.UI（展示层，当前仅 Unity EditorWindow）        │
│  └── DatumWorkbench（5 Tab）通过 DatumContext.Provider 调用 Core│
└─────────────────────────────────────────────────────┘
```

**关键设计原则**：
- `UnityFoeDataProvider` 是 Unity 侧唯一的"脏层"，封装所有 `AssetDatabase` 访问
- Core 计算层完全无 `UnityEngine`/`UnityEditor` 依赖（`AttributeResolver` 保留 `FrameSyncEngine.MazeAiAttrType` 枚举作为属性下标映射）
- 外部工具只需 `JsonFoeDataProvider` + 导出的 JSON 即可运行完整评分管线

### 10.5 拆分路线

| 阶段 | 目标 | 工作量 | 状态 |
|---|---|---|---|
| **Phase 1** | 定义通用 POCO 数据模型（`DatumFoeRow` 等）+ 导出管道（`DatumExportPipeline`） | 1-2天 | ✅ 已完成 |
| **Phase 2** | 定义 `IFoeDataProvider` 接口，实现 `UnityFoeDataProvider` 和 `JsonFoeDataProvider`，重构 Core 层不再直接依赖 `HumanRobotTableData` | 1-2天 | ✅ 已完成 |
| **Phase 3** | 技术选型 + 搭建外部工具原型（Web / 桌面），接入 `JsonFoeDataProvider` | 待定 | 🔲 待规划 |
| **Phase 4** | 配置表自动导出管道（Git Hook / CI 触发 `DatumExportPipeline`） | 1天 | 🔲 待实施 |
| **Phase 5** | 跨项目复用：将 Core 层提取为独立 .NET Standard 类库，支持多游戏项目接入 | 待定 | 🔲 远期目标 |

### 10.6 跨项目数值分析系统技术选型（v4.0 方向讨论）

#### 背景约束

- **团队结构**：数值策划组（多人，负责数值调整）+ 战斗策划组（多人，负责技能/AI 设计），并非所有人都使用 Unity
- **协作方式**：所有改动通过 Git 同步，配置表和技能蓝图均在 Git 仓库中
- **复用目标**：后续其他关卡设计项目（如自动散布怪物）也需要 Datum 的评分能力
- **核心诉求**：策划能在不打开 Unity 的情况下查看和模拟数值效果

#### 技术选型对比

**方案 A：纯前端 Web（HTML + TypeScript，数据从 Git 拉取）**

- 架构：GitHub Pages / 内网 Nginx 静态部署，前端直接 fetch JSON 文件（即 `datum_export/` 输出）
- 数据更新：Git Hook 触发 `DatumExportPipeline` 重新生成 JSON 并提交；前端每次访问拉最新数据
- 优点：零服务器运维；访问门槛最低（浏览器即可）；部署成本极低
- 缺点：Core 计算逻辑需要用 TypeScript 重写（或直接消费预计算的 `monster_scores.json` 跳过重写）；无法实时调权重后重算
- **适用**：如果只需要"查看评分结果"，不需要在线改权重，这个方案足够

**方案 B：轻量后端 API + Web 前端（推荐）**

- 架构：ASP.NET Core（或 Python FastAPI）后端 + React/Vue 前端
- 数据流：后端读取 `datum_export/` JSON → 内存加载 → REST API → 前端可视化 + 实时调参
- 优点：
  - 直接复用 C# Core 层（ASP.NET Core 方案可以直接引用 `Datum.Core` dll）
  - 支持"实时调权重后立即重算"的交互体验
  - 多人同时访问，团队共享同一数据视图
  - 后端轻量，一台内网机器即可
- 缺点：需要部署一个服务（内网 Docker 容器即可，几十分钟搞定）
- **适用**：中大型团队，需要实时调参和协作查看

**方案 C：Tauri 桌面应用（本地优先）**

- 架构：Tauri（Rust 壳 + Web 前端）直接读取本地 Git 仓库中的 `datum_export/` JSON
- 优点：原生文件系统访问，可监听文件变更实时刷新；不需要服务器；支持离线
- 缺点：需要安装包分发；多人协作时各自本地数据不同步（取决于 Git pull 频率）；跨平台维护成本
- **适用**：团队小、网络环境受限、不想维护服务器

#### 关键决策维度

| 维度 | 方案 A | 方案 B | 方案 C |
|---|---|---|---|
| 部署成本 | 极低（静态文件）| 低（内网容器）| 无服务器 |
| 实时调参 | ❌ 不支持 | ✅ 支持 | ✅ 支持 |
| C# Core 复用 | ❌ 需重写 | ✅ 直接引用 | ❌ 需重写或绑定 |
| 多人协作 | ✅ 共享 URL | ✅ 共享 URL | ❌ 各自本地 |
| 跨项目复用 | 🔶 改前端 | ✅ 换数据源 | 🔶 改应用 |
| 访问门槛 | 浏览器即可 | 浏览器即可 | 需安装 |

#### 推荐结论

> **短期（当前项目）**：采用方案 B（ASP.NET Core + React）。
> - 后端直接引用 `Datum.Core`（把 Core 层提取成 .NET Standard 类库，Unity 和后端共用同一份代码）
> - 数据来源切换为 `JsonFoeDataProvider`，读取 `datum_export/` 中的 JSON
> - 前端实现权重调节 + 评分图表 + 关卡散布视图
>
> **中期（跨项目复用）**：不同项目只需要实现自己的 `IFoeDataProvider`（或直接用导出 JSON），即可复用同一套 `Datum.Core` 计算逻辑。
>
> **数据更新自动化**：在 Unity 项目的 Git Hook（`post-commit` / `post-merge`）中调用 Unity `-batchmode -executeMethod DatumExportMenu.ExportAll`，自动刷新 `datum_export/` 并提交，后端监听文件变更后热重载数据。

---

*最后更新：2026-03-02*  
*版本：v1.0（Editor 工具 MVP），v2.0（技能DPS + 控制双侧 + Power Mean + 玩家基准），v3.0（权重校准 + 模板系统 + Workbench 统一工作台），v4.0（Provider 接口 + 导出管道，Phase1+Phase2 完成）*
