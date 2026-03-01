# 项目系统参考文档

> 本文档记录 HumanRobot 项目各核心系统的关键实现细节，供后续开发快速上手使用。
> 最后更新：2026-03

---

## 目录

1. [项目整体架构](#1-项目整体架构)
2. [FrameSync（FS）框架基础](#2-framesyncfs框架基础)
3. [怪物数值配置表（HRMazeFoeV8）](#3-怪物数值配置表-hrmaze-foev8)
4. [怪物生成与属性缩放](#4-怪物生成与属性缩放)
5. [关卡配置表（HRMazeBarriesV8）](#5-关卡配置表-hrmazebarriesv8)
6. [技能系统](#6-技能系统)
7. [伤害计算系统](#7-伤害计算系统)
8. [Buff 系统](#8-buff-系统)
9. [控制/状态系统](#9-控制状态系统)
10. [怪物 AI 系统](#10-怪物-ai-系统)
11. [属性系统](#11-属性系统)
12. [装备系统](#12-装备系统)
13. [宝石镶嵌系统](#13-宝石镶嵌系统)
14. [玩家属性面板](#14-玩家属性面板)
15. [Datum 数值评估工具（v1）](#15-datum-数值评估工具-v1)

---

## 1. 项目整体架构

### 技术栈

- **同步框架**：FrameSync（FS）自研确定性帧同步框架，DSL 文件后缀 `.qtn`
- **语言**：C#，使用 `unsafe` 指针操作 FS 组件
- **物理**：FS 定点数物理（`FP`、`FPVector3`、`FPQuaternion`），保证跨端确定性
- **编辑器工具**：Unity Editor 扩展，位于 `Assets/Editor/` 目录

### 核心目录结构

```
Assets/
├── FrameSyncUser/Simulation/
│   ├── DSL/                    # .qtn 定义文件（组件/信号/事件）
│   ├── AI/                     # AI 行为节点（BT + HFSM）
│   ├── Systems/                # ECS 系统
│   ├── Components/             # 补充组件逻辑
│   ├── Config/HumanRobotTable/ # 配置表（Generated/ 为自动生成）
│   └── Asset/Skill/            # SkillConfigAsset 数据类定义
├── Editor/
│   ├── Blueprints/Skills/      # 技能蓝图配置 (.asset) + Timeline (.playable)
│   ├── Datum/                  # 数值评估工具
│   └── FindReference2/         # 引用查找工具
└── Scripts/BlueprintEditor/    # 技能蓝图编辑器
```

---

## 2. FrameSync（FS）框架基础

### DSL（.qtn）文件

FS 框架通过 `.qtn` 文件定义 ECS 结构，自动生成对应 C# 代码：

```qtn
component FooComponent { int Value; }        // 组件
signal OnFoo(EntityRef entity);              // 信号（帧内同步调用）
client synced event FooEvent { int Value; }  // 事件（传到客户端View层）
flags FooFlags { A, B, C }                   // 位标志枚举
```

### 关键类型

| 类型 | 说明 |
|---|---|
| `FP` | 定点数（Fixed Point），替代 float 保证确定性 |
| `FPVector3` | 定点数向量，`RawValue` 存储内部值 |
| `EntityRef` | 实体引用（含 Index + Version） |
| `Frame` | 当前帧数据，所有系统入口 |
| `PausibleFrameTimer` | 支持暂停的帧计时器 |

### 系统类型

- `SystemMainThreadFilter<Filter>`：主线程过滤系统（最常用）
- `SystemSignalsOnly`：仅处理信号的系统
- `ISignalXxx`：信号接口，系统实现后可接收对应信号

### 长度单位

代码中长度单位为**毫米（mm）**，`FP` 的 `RawValue` 需除以 `65536` 得到实际值（例：`RawValue: 131072` = `2.0` = 2mm）。

---

## 3. 怪物数值配置表（HRMazeFoeV8）

### 文件路径

```
Assets/FrameSyncUser/Simulation/Config/HumanRobotTable/Generated/
  HumanRobotTableData.MazeFoeV8.gen.cs
```

运行时数据资产：`Assets/Res/FrameSync/Table/HumanRobotTableData.asset`

### 关键字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `Attack_max` | `int` | 攻击力上限 |
| `Def_max` | `int` | 防御力上限 |
| `Hp_max` | `int` | 血量上限 |
| `Tough_max` | `int` | 韧性上限（抗打断能力，越高越难被玩家控制） |
| `Tough_deplete` | `int` | 韧性耗损速率 |
| `Tough_borke_raitio` | `LongIntPair[]` | 韧性破坏比例 |
| `Nor_attack_skill_id` | `int` | 普攻技能 ID → 对应 SkillConfigAsset.SkillID |
| `Attack_skill_id[]` | `int[]` | 主动技能 ID 数组（每个对应一个 SkillConfigAsset） |
| `Passive_skill_id[]` | `int[]` | 被动技能 ID 数组 |
| `Attack_speed_pro` | `int` | **仅影响动画播放速度（View层），不影响逻辑层打击点帧数** |
| `In_barries_id` | `int` | 所属关卡 ID（用于按关卡筛选怪物） |
| `Foe_type` | `int` | 怪物类型（对应 `BattleFoeType` 枚举） |
| `Level` | `int` | 怪物等级 |
| `Kongfu` | `int` | 武力值（综合战力参考值） |
| `Speed` | `int` | 移动速度 |
| `Fire_res/Ice_res/Poi_res/Ele_res` | `int` | 各元素抗性 |

### 关卡映射

`In_barries_id` 是怪物与关卡（Barries）的关联字段，同一关卡可有多个相同名称、不同数值的怪物。关卡配置表为 `MazeBarriesV8`。

### BattleFoeType 枚举

```csharp
None = 0, Creeps = 1, Boss = 4, Elite = 5, Special = 6, Dummy = 9
```

---

## 4. 怪物生成与刷怪系统

### 两套刷怪系统

项目中存在两套刷怪系统：

| 维度 | 配置表驱动（主力） | 时间线驱动（⏳ 实验性质） |
|---|---|---|
| 调度系统 | `SpawnSchedulerSystem` | `PathBasedSpawnSystem` |
| 执行系统 | `SpawnExecutionSystem` | `PathBasedSpawnSystem.Utils` |
| 数据来源 | `MazeTriggerBrushFoeV8` 配置表 | `SpawnTimelineData` Asset（编辑器导出） |
| 怪物列表 | `Monsterslist_ids_and_nums`（ID+数量对） | `Timeline[].MonsterIds`（按帧预计算） |
| 波次控制 | `Interval_times_and_nums` 定义波次间隔+数量 | 时间轴帧号精确控制 |
| 刷怪位置 | 区域内随机（大小圆/多边形） | 多边形区域/行进路径 |
| 预设怪 | `Is_def_show` 标志 + 距离检测 | `PresetMonsterAreaData` + 碰撞盒触发 |

> **时间线驱动系统目前为实验性质，Datum 工具暂不需要考虑其数据。**

### 怪物实体创建流程

```
SpawnSchedulerSystem
  → ActivateArea(barrierId, triggerId)
    → 按 Interval_times_and_nums 分波次加入队列
      → SpawnExecutionSystem.Update()
        → 发送 CreateMonster 信号（MonsterBuildInfo）
          → MonsterEnityBuildSystem.CreateMonster()
            → 创建 Entity + 初始化所有组件
```

核心代码：
- 调度：`Assets/FrameSyncUser/Simulation/Systems/Fight/SpawnSchedulerSystem.cs`
- 执行：`Assets/FrameSyncUser/Simulation/Systems/Fight/SpawnExecutionSystem.cs`
- 构建：`Assets/FrameSyncUser/Simulation/Systems/EnityBuild/MonsterEnityBuildSystem.cs`

### 属性缩放系数（Attr_coefficient）

刷怪配置表 `MazeTriggerBrushFoeV8` 中的 `Attr_coefficient` 可按万分比缩放怪物属性：

```
Attr_coefficient[0] → 攻击力缩放（0 表示不缩放即 ×1）
Attr_coefficient[1] → 防御力缩放
Attr_coefficient[2] → 血量缩放
```

> **Datum 工具影响**：v1 直接读 `MazeFoeV8` 基础值，未考虑缩放系数。但当前大多数关卡的 `Attr_coefficient` 为空或为 0（即不缩放），暂时不是紧迫问题。

### 刷怪配置表（MazeTriggerBrushFoeV8）

```
Assets/FrameSyncUser/Simulation/Config/HumanRobotTable/Generated/
  HumanRobotTableData.MazeTriggerBrushFoeV8.gen.cs
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `Id` | `int` | 刷怪配置 ID |
| `Barries_id` | `int` | 所属关卡 ID |
| `Trigger_id` | `int` | 触发器 ID |
| `Region_id` | `int` | 区域 ID |
| `Attr_coefficient` | `int[]` | 属性缩放系数（万分比），依次为[攻击, 防御, 血量] |
| `Monsterslist_ids_and_nums` | `IntIntPair[]` | 怪物ID + 数量对 |
| `Monster_max_num` | `int` | 同时存在最大怪物数 |
| `Interval_time` | `int` | 刷怪间隔（ms） |
| `Brush_method` | `int` | 刷怪方式 |
| `Brush_range` | `int` | 刷怪范围 |
| `Monster_facing` | `int[]` | 每只怪物初始朝向 |
| `Is_def_show` | `int` | 是否默认显示 |

### 怪物创建时初始化的属性一览

在 `MonsterEnityBuildSystem.CreateMonster()` 中，以下属性被写入 `AttributeComponent.BaseAttributes`：

| 属性 | 来源 | Figure |
|---|---|---|
| `RoleAtkValue` | `Attack_max`（可被 Attr_coefficient 缩放） | 1 (固定值) |
| `RoleDefValue` | `Def_max`（可被 Attr_coefficient 缩放） | 1 |
| `AtkSpeed` | `Attack_speed_pro` | 2 (万分比) |
| `RecoverySpeed` | `Be_attack_recovery_speed_pro` | 2 |
| `ToughMax` | `Tough_max` | 1 |
| `IceDefValuePer` | `Ice_res` | 2 |
| `FireDefValuePer` | `Fire_res` | 2 |
| `PoisonDefValuePer` | `Poi_res` | 2 |
| `ElectricityDefValuePer` | `Ele_res` | 2 |

> `Figure=1` 表示固定值，`Figure=2` 表示万分比。

### 刷怪波次机制（SpawnSchedulerSystem）

1. `ActivateArea(barrierId, triggerId)` 触发刷怪
2. 按 `MazeTriggerBrushFoeV8` 表筛选当前关卡+触发器的配置行，按 `Interval_time` 排序
3. 每行配置初始化 `RemainingCounts`（来自 `Monsterslist_ids_and_nums`）
4. 按 `Interval_times_and_nums` 定义的小波时间+数量逐波触发
5. 每波通过加权随机采样从剩余池中抽取怪物 ID
6. 当场上怪物清零且当前行未完成时，强制触发下一波
7. 所有行刷完且场上怪物清零 → 战斗结束

场上怪物数量达到 `AreaMaxCap`（默认 50）时暂停刷怪，数量减少后恢复。

### 精英/Boss 特殊组件

```csharp
if (FoeType == Elite || FoeType == Boss)
{
    f.AddOrGet<FightPoiseComponent>(entity, out var poise);
    poise->Init(f, dataComp->PoiseValue);  // 躯干值（气绝系统）
}
```

---

## 5. 关卡配置表（HRMazeBarriesV8）

### 文件路径

```
Assets/FrameSyncUser/Simulation/Config/HumanRobotTable/Generated/
  HumanRobotTableData.MazeBarriesV8.gen.cs
```

### 关键字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `Value_int` | `long` | 关卡内部 ID |
| `Order` | `int` | 关卡排序号 |
| `Display_mon_level` | `int` | 显示怪物等级 |
| `Hp_num` | `int` | 关卡血药瓶数量 |
| `Hp_vial` | `int` | 血药瓶恢复量 |
| `Initial_speed` | `int` | 初始速度 |
| `Barries_add_kongfu` | `int` | 通关增加武力值 |
| `Succeed_exp` | `int` | 通关奖励经验 |
| `Lose_exp` | `int` | 失败扣除经验 |
| `Mon_id1~Mon_id8` | `int` | 关卡可出现的怪物配置 ID（最多8种） |
| `Monster_ordinary_info` | `int[]` | 普通怪物信息 |
| `Monster_elite_info` | `int[]` | 精英怪物信息 |
| `Monster_boss_info` | `int[]` | Boss 信息 |
| `Monster_max_num` | `IntIntPair[]` | 区域最大怪物数限制 |
| `Brush_monsters_range` | `IntIntPair[]` | 刷怪数量范围 |
| `Region_kongfu` | `IntIntPair[]` | 区域武力值要求 |
| `Attack_action1/2/3_need_kongfu` | `IntLongPair[]` | 各攻击行动所需武力值 |
| `Drop_equip_lv_min/max` | `int` | 掉落装备等级范围 |
| `Equ_drop` | `int` | 装备掉落配置 |
| `Energy_id` | `int` | 能量配置 ID |
| `Energy_affix_rand_rule` | `int` | 能量词条随机规则 |

---

## 6. 技能系统

### 整体架构

技能系统分为三层：

```
配置层：HRMazeSkillInfoV8（表格）+ SkillConfigAsset（蓝图资产）
         ↓
逻辑层：FightSkillCastComponent → FightSkillExecuteComponent
         ↓
表现层：PlayAnimOrSkillComponent + View 事件
```

### 技能配置表（HRMazeSkillInfoV8）

```
Assets/…/HumanRobotTableData.MazeSkillInfoV8.gen.cs
```

| 字段 | 说明 |
|---|---|
| `Id` | 技能 ID（与 SkillConfigAsset.SkillID 对应） |
| `Type` | 技能类型（`SkillSpellType`：普攻/主动/被动等） |
| `Skill_cool_time` | `IntIntPair[]` 冷却时间（Key=等级，Value=冷却毫秒） |
| `Damage_rate` | `IntIntPair[]` 伤害系数（Key=等级，Value=万分比） |
| `Skill_group` | 同组 CD 共享，同级最高级技能覆盖低级 |
| `Self_effect` | `int[]` 被动触发的 Buff ID 列表 |
| `Cd_adjust_ratio` | `int[]` CD 缩减属性 ID 列表（最多减少 50%） |

### SkillConfigAsset（蓝图资产）

**文件路径：** `Assets/Editor/Blueprints/Skills/` 下的 `.asset` 文件，有两类：
- `*_Default.asset`：`BlueprintEditorConfig`（蓝图编辑器配置，含预览参数）
- `*_FromSkillConfig.asset`：从 SkillConfigAsset 导入生成的蓝图配置

运行时通过 `frame.GetSkillConfigData().GetSkillConfigAsset(skillId, roleId)` 加载。

**核心字段：**

| 字段 | 说明 |
|---|---|
| `SkillID` | 技能 ID（对应表格 ID） |
| `ContinuousFrames` | 技能总帧数（@30fps，决定技能执行时长） |
| `SkillType` | 技能类型（1-999=战斗技能，10000+=机关技能） |
| `CastPriority` | 释放优先级（数值越高越先释放） |
| `ReleaseRangeMax/Min` | 释放距离范围（mm） |

**能力帧分组（AbilityFrameGroup）：**

技能按帧分组，每帧可触发多个能力（`SkillAbilityConfig` 的子类）：

```csharp
_abilityConfigList: List<AbilityFrameGroup>   // 逻辑层能力
_viewAbilityConfigList: List<AbilityFrameGroup> // 表现层能力
```

### 能力类型（SkillAbilityType）

| 类型 | 枚举值 | 说明 |
|---|---|---|
| `SingleAttack` | 1 | 单次打击（最常用，含控制效果字段） |
| `HealthRecovery` | 2 | 治疗 |
| `AddBuff` | 3 | 添加 Buff |
| `ContinuousAttack` | 10 | 持续/范围打击（含间隔/持续时间） |
| `Dash` | 12 | 冲锋移动 |
| `Knockback` | 16 | 击退 |
| `SkillPhase` | 15 | 技能阶段（前摇/后摇分段） |
| `PlayAnimation` | 100 | 播放动画（表现层） |

### SkillSingleAttackAbilityConfig 关键字段

```csharp
DamageBaseValuePer  // 伤害基准系数（万分比），如 2500 = 25% 攻击力
DamageElement       // 伤害元素类型（物理/冰/火/毒/电）
CanAirborne         // 是否击飞（最强控制效果）
VerticalSpeed       // 击飞垂直初速度（FP，RawValue/65536）
HorizontalSpeed     // 击飞水平初速度
CanKnockDown        // 是否击倒
CanStiffness        // 是否造成硬直
StiffnessLevel      // 硬直等级（FP）
PoiseDamage         // 躯干值伤害（累积到阈值触发气绝）
HitDeathLevel       // 死亡动作等级
MaxTargets          // 最大命中目标数（0=不限）
TeamMask            // 目标阵营筛选
```

### 技能冷却机制

```
CD 设置：cast->SetCoolDown(f, skillId, cdTime * cdAdjustRatio / 1000)
CD 来源：HRMazeSkillInfoV8Row.Skill_cool_time（毫秒）
CD 缩减：Skill_cool_time × (1 - cdAdjustRatio)，最多缩减 50%
公共CD：写死 3 秒（TODO，未来可配置）
```

### 技能执行帧推进

**关键结论：`Attack_speed_pro` 不影响逻辑层帧推进。**

```csharp
// FightSkillExecuteComponent.Helpers.cs
public int GetElapsedFrames(Frame frame) => frame.GameFrameCount - StartFrame;
public bool ShouldFinish(Frame frame) => GetElapsedFrames(frame) > ContinuousFrames;
```

帧推进是纯物理帧计数，`Attack_speed_pro` 只传给 `PlayAnimOrSkillComponent` 影响动画表现速度，**对打击点触发时机和 DPS 计算没有影响**。

### 真实 DPS 计算公式

```
技能总伤害系数 = Σ(所有打击点的 DamageBaseValuePer) / 10000
技能循环时间(秒) = ContinuousFrames / 30 + Skill_cool_time / 1000
单技能DPS = Attack_max × 技能总伤害系数 / 技能循环时间
```

实例（怪_骷髅3_二连击）：
- `ContinuousFrames=20`（0.667秒）
- 4 个打击点各 `DamageBaseValuePer=2500`，总系数 = 1.0
- 假设 CD = 1000ms，循环时间 = 0.667 + 1.0 = 1.667秒
- DPS = `Attack_max × 1.0 / 1.667` ≈ `0.6 × Attack_max /秒`

### 技能蓝图编辑器

- **蓝图文件**：`Assets/Editor/Blueprints/Skills/*.playable`（Timeline 资产）
- **蓝图配置**：`Assets/Editor/Blueprints/Skills/*_Default.asset`（`BlueprintEditorConfig`）
- **导出资产**：`BlueprintEditorSettings.Instance.ExportDirectory` 下的 `*_Skill_Config.asset`
- 导出逻辑：`SkillConfigAssetExporter.cs` 将 Timeline 中的 Marker/Clip 按帧分组写入 `SkillConfigAsset`
- 导入逻辑：`SkillConfigAssetImporter.cs` 反向从 `SkillConfigAsset` 重建 Timeline

---

## 7. 伤害计算系统

### 伤害信息结构（DamageInfo）

```csharp
struct DamageInfo {
    EntityRef Source, Target;
    DamageSourceType SourceType;  // Skill / Buff
    int SourceId;                 // 技能ID或BuffID
    DamageValue Damage;           // { FP Value, ControlElementAttrResType type }
    FP DamageBaseValuePer;        // 打击点伤害基准系数（万分比）
    FP DamageRate;                // 技能伤害系数
    int PoiseDamage;              // 躯干值伤害
    bool CanCauseStagger;         // 是否可造成气绝
    bool CanAirborne;             // 是否击飞
    bool CanKnockDown;            // 是否击倒
    bool CanStiffness;            // 是否硬直
    FP StiffnessLevel;            // 硬直等级
}
```

### 伤害元素类型（ControlElementAttrResType）

`Def`（物理）/ `AttrIce`（冰）/ `AttrFire`（火）/ `AttrPoison`（毒）/ `AttrLightning`（电）及其组合（冰火、冰毒等至 `AttrAllElements`）。

### 伤害信号链路

```
技能打击 → OnSkillAttack 信号 → HumanRobotDamageCalculationSystem
                                  ├── AssembleData.cs  (数据组装)
                                  ├── BuffDamage.cs    (Buff伤害)
                                  └── AddHp.cs         (治疗)
Buff伤害 → OnBuffAttack 信号 → 同上
```

---

## 8. Buff 系统

### 核心结构

```csharp
// FightBuffComponent 存储所有运行时 Buff
dictionary<ulong, RuntimeBuffInfo> Buffs          // 按 BuffInstanceID 索引
dictionary<BuffValidType, BuffInstanceIDListStr> TypeBuffs  // 按类型分组
```

### BuffValidType 标志（可多选）

| 标志 | 说明 |
|---|---|
| `Once` | 添加后立即执行，生命周期只有 OnAwake |
| `Tick` | 每帧驱动，执行 OnUpdate |
| `Trigger` | 条件触发，执行 OnBuffTrigger |
| `ChangeModifier` | 修改属性（属性加成 Buff） |
| `ChangeDamage` | 影响伤害计算 |
| `MutualExclusivity` | 互斥 Buff（不可与某些 Buff 共存） |
| `RefreshOrReplacement` | 刷新持续时间或替换 |

### 属性修改

带 `ChangeModifier` 标志的 Buff 通过 `AttributeModifierCollector` 修改属性，由 `AttrExecutorSystem` 每帧应用：
- `Fix` 类型：固定值加减
- `Per` 类型：百分比加减

### 触发器类型（BuffTriggerType）

`TargetDied` / `BurningTargetDied` / `ParalysisTargetDied` / `PoisonTargetDied` / `IceTargetDied` / `FrozenBreak`（碎冰）/ `Damage`（造成伤害时）

---

## 9. 控制/状态系统

### 怪物状态组件（CharacterFightStateComponent）

```qtn
component CharacterFightStateComponent {
    long StateBits;                    // CharacterState 位标志
    long ProhibitedBehaviorStateBits;  // FightProhibitedBehaviorTypes 位标志
    byte GeneralAbnormalStateBits;     // GeneralAbnormalStateType 位标志
    byte SpecialAbnormalStateBits;     // SpecialAbnormalStateType 位标志
}
```

### 通用异常状态（GeneralAbnormalStateType）

`Dodge`（闪避）/ `KnockDown`（倒地）/ `Airborne`（浮空）/ `Stagger`（气绝）/ `Slow`（减速）/ `Immobilize`（禁锢，可攻击但不能移动）

### 特殊异常状态（SpecialAbnormalStateType，元素）

`Frozen`（冰冻）/ `Electrified`（感电）/ `Poisoned`（中毒）/ `Plague`（疫病）

### 控制状态（CrowdControlState）

```
None → Stiffness（硬直）→ Frozen（冻结）→ Airborne（浮空）→ KnockDown（倒地）
```

### 韧性（Tough）系统

```qtn
component FightToughComponent { int CurrentTough; int MaxTough; }
```

- 韧性满时怪物抗打断；被耗尽触发倒地/硬直
- `Tough_max`：韧性上限（`HRMazeFoeV8Row`）
- `Tough_deplete`：韧性耗损速率

### 躯干值（Poise）系统（精英/Boss专属）

```qtn
component FightPoiseComponent {
    int MaxPoise;              // 最大躯干值
    int CurrentPoise;          // 当前躯干值
    int PoiseRecoveryRate;     // 每帧恢复速率
    int PoiseRecoveryDelay;    // 受击后恢复延迟帧
    bool IsStaggered;          // 是否气绝中
}
```

躯干值被 `PoiseDamage` 削减至 0 触发气绝（`Stagger`），期间怪物无法行动。

### 击飞/击退

```
击飞（Airborne）：AirborneComponent 控制抛物线运动，受 VerticalSpeed/HorizontalSpeed/Gravity 影响
击退（Knockback）：FightKnockbackComponent + KnockbackDirectionType（RadialOut/RadialIn/AttackerForward/TargetBackward）
```

---

## 10. 怪物 AI 系统

### AI 架构

怪物 AI 使用 **行为树（BT）+ 层次状态机（HFSM）** 混合架构：

```
BTUpdateSystem → BT 行为树节点驱动
HFSMUpdateSystem → 动画状态机驱动
MonsterCompoundUpdateSystem → 综合更新（BT + HFSM）
```

### 关键 Action 节点

| 节点 | 功能 |
|---|---|
| `GetMonsterAtkSkill` | 选择本轮释放的技能（按 CastPriority 优先，CD 满足则随机） |
| `GetAtkSpeedAttrAction` | 读取 `AtkSpeed` 属性写入黑板（仅影响动画） |
| `AtkTargetAction` | 执行攻击（发送 `StartSkill` 信号） |
| `PlayNotAtkSkillAction` | 播放非攻击技能（特殊演出）|
| `PatrolAction` | 巡逻行为 |
| `MoveToTargetPointAction` | 移动到目标点 |

### 技能选择逻辑（GetMonsterAtkSkill）

```
1. 检查公共CD（PublicCooldownTimer），在CD中返回 0
2. 遍历 SkillDic，筛选出 CD=0 且 CastPriority 最高的技能组
3. 同优先级多技能 → 随机选一个
4. 全部在CD中 → 选剩余时间最短的技能
```

### 普攻冷却

怪物普攻 CD 来自 `HRMazeSkillInfoV8Row.Skill_cool_time`，在 `HumanRobotFightSkillCastSystem.StartSkill` 中设置：

```csharp
cdTime = baseValue + attrModifier  // baseValue 来自配置表
cd = cdTime * cdAdjustRatio / 1000 // 转换为秒
cast->SetCoolDown(f, skillId, cd)
```

### 怪物数据组件（MonsterDataComponent）

```qtn
NorAttackSkillId  // 普攻技能ID（冗余存储，便于运行时快速访问）
ToughMax          // 韧性上限
PoiseValue        // 躯干值上限
FoeType           // 怪物类型
Level             // 怪物等级
BarrierId         // 所属关卡ID
```

---

## 11. 属性系统

### 属性组件（AttributeComponent）

```
BaseAttributes    // 基础属性（配置表初始化，dictionary<int, AttributeValue>）
DynamicAttributes // 动态属性（Buff叠加后的运行时值）
```

属性 ID 来自 `MazeAiAttrType` 枚举：

| 属性 ID | 枚举 | 说明 |
|---|---|---|
| `3010000` | `RoleAtkValue` | 攻击力 |
| `3020000` | `RoleDefValue` | 防御力 |
| `3030000` | `RoleHPValue` | 血量 |
| `3040901` | `AtkSpeed` | 攻速（影响动画，不影响逻辑帧） |
| `3701201` | `DodgeValue` | 闪避值 |

### 属性修改（AttrExecutorSystem）

每帧检查 `NeedApplyModifier` 标志，遍历所有 `ChangeModifier` 类型的 Buff，将属性修改器（`Fix` 固定值 + `Per` 百分比）叠加到 `DynamicAttributes`。

---

## 12. 装备系统

### 代码位置

```
Assets/Scripts/HumanRobot/Module/Equip/
├── Vo/             # 数据模型（VO）
├── Model/          # Proxy（网络通信 + 数据管理）
├── View/           # UI 组件 + Mediator
├── Helper/         # 工具函数
├── Enum/           # 枚举定义
├── Controller/     # 命令
└── FGui/           # FairyGUI 生成代码
```

> 装备系统是**客户端 UI 层**（非帧同步层），数据来自服务器 Protobuf 协议 `Pb.MazeGameEquip`。
> 属性配置表引用 `MazeAttributeV8Config`（`Config.MazeAttributeV8Config`），不在 HR 表内。

### 装备信息（DollEquipInfoVo）

| 字段 | 类型 | 说明 |
|---|---|---|
| `EquipId` | `int` | 装备配置 ID |
| `EquipGuid` | `long` | 实例唯一 ID |
| `ForceValue` | `long` | 武力值（综合战斗力） |
| `EquipLevel` | `int` | 装备等级 |
| `Pos` | `int` | 装备部位（`ENUM_ELEMENTS_POS`） |
| `EquipQuality` | `int` | 装备品质（`ENUM_ELEMENTS_QUALITY`） |
| `Grade` | `int` | 装备阶级 |
| `Score` | `int` | 装备积分 |
| `MainAttrs` | `BaseAttrInfoVo` | 主属性（1条） |
| `BaseAttrs` | `List<BaseAttrInfoVo>` | 基础/随机词条（多条） |
| `LegendAttrs` | `List<BaseAttrInfoVo>` | 传奇属性 |
| `SuitInfo` | `EquipSuitInfoVo` | 套装信息 |
| `SkillSlotInfo` | `SkillSlotInfoVo` | 技能孔信息 |
| `StrengthScore` | `long` | 实力评分 |
| `HurtType` | `ENUM_EQUIP_HURT_TYPE` | 伤害类型（物理/冰/火/毒/电） |

### 装备属性词条（BaseAttrInfoVo + EquipAttrInfoVo）

每条词条由 `BaseAttrInfoVo` 包裹 `EquipAttrInfoVo`：

| 字段 | 说明 |
|---|---|
| `AttrInfo.attr_id` | 属性 ID（与 `MazeAiAttrType` / `MazeAttributeV8Config` 对应） |
| `AttrInfo.value` | 当前数值 |
| `AttrInfo.min_value` / `max_value` | 数值范围（词条可洗练/精炼） |
| `AttrInfo.figure` | 数值类型：1=固定值，2=万分比，3=百万分比 |
| `AttrInfo.special_symbol` | 前缀符号（如 "+"） |
| `AttrInfo.attr_units` | 后缀单位（如 "秒"） |
| `AttrInfo.scoreTap` | 档位：1=差(白)，2=一般(蓝)，3=好(红)，4=特别好(黄) |
| `AttrType` | 属性类型 |
| `Status` | 词条状态标志：`Wash`(可洗练) / `Refine`(可精炼) |
| `Rare` | 0=普通词条，1=稀有词条 |

### 装备部位枚举（ENUM_ELEMENTS_POS）

```
武器=1, 帽子=2, 上衣=3, 裤子=4, 指环=5, 鞋子=6, 护手=7, 装饰=8, 腰带=9, 护符=10
```

### 装备品质枚举（ENUM_ELEMENTS_QUALITY）

```
白(普通)=1, 蓝(精良)=3, 紫(史诗)=5, 橙(神话)=6, 绿(普通)=7, 红(传奇)=8, 彩(套装)=10
```

### 装备位强化系统

每个装备**部位**有独立的强化等级（`EquipPosStrengthenInfoVo.level`），强化后提供额外属性加成（`AttrChgInfoVo`）。

- 强化消耗：银子 + 其他材料（`EquipPosStCondVo.cost_items`）
- 强化前置：需要其他装备位达到一定等级（`need_other_lv`）或人偶等级（`need_doll_lv`）
- 强化预览：`MazeEquipPosLvUpPreviewRS` 返回当前/下一级属性对比
- 满级判断：`StLevel.nextValue == 0`

### 装备成长系统（洗练 & 精炼）

| 操作 | 枚举 | 说明 |
|---|---|---|
| **洗练（Reforge）** | `EnumGrowthType.Reforge` | 重新随机词条**类型**（换词条） |
| **精炼（Refine）** | `EnumGrowthType.Refine` | 重新随机词条**数值**（保留类型） |

流程：选择词条 → 消耗材料 → 服务器返回新词条 → 玩家选择保留或放弃。

消耗配置来自 `EquipRefinedConsumeV8Config`，按 `quality` + `grade` 查询。

### 套装系统（EquipSuitInfoVo）

- `SuitId`：套装 ID
- `SuitPosList`：套装各部位及激活状态
- `SuitNumList`：集齐 N 件激活效果
- `SuitType`：套装类型

套装属性列表存储在 `SuitAttrList` 中。

---

## 13. 宝石镶嵌系统

### 代码位置

```
Assets/Scripts/HumanRobot/Module/HumanRobotGem/
├── Vo/     # GemInfoVo, GemDressInfoVo, GemStoneInfoVo
├── Model/  # GemProxy
├── View/   # 镶嵌/替换 UI
└── Enum/   # GemEnum
```

### 核心数据结构

**GemDressInfoVo**（镶嵌位信息）：

| 字段 | 说明 |
|---|---|
| `Pos` | 镶嵌位置（对应装备部位） |
| `SubPos` | 镶嵌子位置（同一部位多个孔位） |
| `PosUnlock` | 0=未解锁，1=待解锁，2=已解锁 |
| `GemInfo` | 当前镶嵌的宝石信息（`GemStoneInfoVo`） |
| `GemsHightLevel` | 宝石最大等级 |

**GemInfoVo**（宝石基础信息）：
- 基于通用背包道具 `HumanRobotBagItemVo`
- `ItemId`：宝石配置 ID
- `Quality`：品质
- `OrderType`：同品质排序

宝石镶嵌在 `EquipPosInfoVo.DressInfoVos` 中管理，每个装备位可有多个宝石孔。

---

## 14. 玩家属性面板

### 数据结构

属性面板通过 `QueryMazePropertyPanelRS` 协议从服务器获取，解析为：

```
MazePropertyPanellVo
  └── attr_group: List<MazePropertyGroupVo>
        ├── group_id   // 分组ID（用于排序）
        ├── group_name // 分组名称
        └── attrs: List<EquipAttrInfoVo>
              ├── attr_id    // 属性ID
              ├── value      // 当前值
              ├── figure     // 数值类型
              └── attrName   // 属性名称（来自 MazeAttributeV8Config）
```

### 玩家属性来源

玩家最终属性 = 基础属性 + 装备属性 + 装备位强化属性 + 宝石属性 + 套装属性 + Buff属性

在帧同步层，玩家属性通过 `FightHPComponent.SetUserTotalHealth()` 同步血量，其他属性通过 `AttributeComponent` 管理。

### 属性配置表（MazeAttributeV8Config）

这是客户端 Config 层的配置表（非 HR 表），提供属性的显示名称、数值类型等元信息：
- `GetData(attrId)` → 获取属性配置
- `Name`：属性显示名称
- `Figure`：数值类型

---

## 15. Datum 数值评估工具（v1）

### 工具入口

菜单：`Datum → Open Datum`

### 核心架构（5层）

```
Layer 0: Snapshot      AttributeSnapshot（属性快照）
Layer 1: Resolver      AttributeFormulas（公式解析）
Layer 2: Metrics       CombatMetrics（战斗指标）
Layer 3: Aggregator    DifficultyAggregator（难度聚合）
Layer 4: Analyzer      比较分析器（规划中）
```

### 核心指标

| 指标 | 公式 | 说明 |
|---|---|---|
| `EHP` | `HP × (1 + Def/BaselineDef)` | 等效血量（考虑防御减伤） |
| `ExpectedDPS` | `Attack × AttackSpeedFactor` | 预期 DPS（v1 仅用普攻速度，不读技能资产） |
| `Control` | `ToughMax / BaselineControl` | 控制力指标（BaselineControl=5000） |
| `Difficulty` | 加权求和（EHP+DPS+Control 各占比） | 综合难度评分 |

### 权重配置（EvaluationWeightConfig）

路径：`Assets/Editor/Datum/Config/EvaluationWeightConfig.asset`

| 参数 | 默认值 | 说明 |
|---|---|---|
| `BaselineAtk` | `1000` | 攻击力基准 |
| `BaselineDef` | `500` | 防御力基准 |
| `BaselineHP` | `10000` | 血量基准 |
| `BaselineControl` | `5000` | 控制基准（对应 ToughMax 量级） |
| `WeightEHP` | `0.4` | EHP 权重 |
| `WeightDPS` | `0.4` | DPS 权重 |
| `WeightControl` | `0.2` | 控制权重 |

### 已知局限（v1）

1. **DPS 计算不精确**：仅用 `Attack_speed_pro` 参数估算，未读取 `SkillConfigAsset` 实际打击点数据
2. **控制维度单一**：`ToughMax` 代表"怪物被控难度"（防御侧），未计算"怪物控制玩家"（进攻侧）
3. **无玩家基准**：难度分数是怪物间横向相对排名，无法反映对玩家的绝对难度
4. **技能配置未接入**：主动技能的伤害贡献未被计算

### 可视化特性

- **难度条**：对数刻度（`log(1 + score × 9)`），解决长尾分布下小分值不可见问题
- **关卡筛选**：按 `In_barries_id` 筛选，每次仅显示一个关卡的怪物
- **数量聚合**：属性完全相同的怪物（同名+类型+等级+EHP+DPS）合并显示数量

---

## 附录：常见坑点

### 1. IntIntPair 字段命名

配置表中 `IntIntPair` 使用 `Key` 和 `Value`，**不是** `Item1`/`Item2`。

### 2. Attack_speed_pro 的误导性

字段名像是影响攻速/攻击频率，但实际只影响动画播放速度（View 层），逻辑层帧推进不受影响。计算 DPS 时必须从 `SkillConfigAsset.ContinuousFrames` 和打击点读取。

### 3. 技能 CD 的单位

`Skill_cool_time` 的值是**毫秒**，设置冷却时需要除以 1000 转换为秒：
```csharp
cast->SetCoolDown(f, skillId, cdTime / FP._1000);
```

### 4. SkillConfigAsset 有两种同名文件

- `*_Default.asset`：`BlueprintEditorConfig`（蓝图编辑器用），不是技能逻辑配置
- `*_FromSkillConfig.asset` / `*_Skill_Config.asset`：真正的 `SkillConfigAsset`（运行时用）

### 5. 怪物多行配置问题

同一关卡内同名怪物会配置多行（一行一只），`ConfigId` 各不同但属性可能完全一致，需按属性特征键聚合而非按 ID 聚合。

### 6. FP 定点数原始值换算

`FPVector3` 的 `RawValue` 需除以 `65536` 得到实际值：
- `RawValue: 65536` = 1（单位：mm，即 1mm）
- `RawValue: 131072` = 2mm
- `RawValue: 327680` = 5mm（即 5mm 距离）

### 7. 怪物属性缩放系数（低优先级）

`MazeFoeV8.Hp_max` / `Attack_max` / `Def_max` 是基础值，运行时可被 `MazeTriggerBrushFoeV8.Attr_coefficient` 按万分比缩放。当前大多数关卡该字段为空或为 0（即不缩放），Datum v1 直接读基础值是可接受的。

### 8. 装备数据在客户端 UI 层，非帧同步层

装备、词条、套装、宝石等数据来自服务器协议（`Pb.MazeGameEquip`），存储在 `DollEquipProxy` 中。帧同步层只看最终计算后的 `AttributeComponent`，不直接读装备数据。如果 Datum 工具要接入装备强度评估，需要从客户端 Proxy 或 Protobuf 协议中获取。

### 9. 装备品质枚举不连续

`ENUM_ELEMENTS_QUALITY` 的值不是连续的（1,3,5,6,7,8,10），排序和比较时需注意不能简单用数值大小。
