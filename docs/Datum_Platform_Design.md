# Datum Platform — 跨项目数值分析平台设计文档

> **文档版本**：v1.2  
> **创建时间**：2026-03-02  
> **最后更新**：2026-03-02  
> **状态**：开发阶段（Phase 3.1 + 3.2 + 3.3 已完成，前端运行中）  
> **文档位置**：`D:\work\DatumPlatform\docs\`（已从 UnityProject 迁移）  
> **前置文档**：`Datum_Design.md`（Unity Editor 工具设计，Phase1+Phase2 已完成）

---

## 1. 背景与目标

### 1.1 现状

Datum 当前以 Unity Editor 插件形式运行，提供怪物数值评分、模板发现、权重校准等功能。Phase1+Phase2 已完成数据层解耦：

- `IFoeDataProvider` 接口抽象了数据来源
- `DatumExportPipeline` 可将 Unity 侧数据导出为通用 JSON
- Core 计算层已完全无 `UnityEngine`/`UnityEditor` 依赖

### 1.2 痛点

- **访问门槛高**：数值策划和战斗策划必须打开 Unity 才能查看评分，不用 Unity 的策划被完全排除在外
- **协作困难**：多位策划通过 Git 同步配置表，但每人需要各自在 Unity 中手动刷新，无法共享同一视图
- **复用障碍**：当前工具与 `HumanRobotTableData` 强绑定（Phase1+Phase2 已解决接口层），但尚无独立运行的外部工具

### 1.3 目标

| 目标 | 描述 |
|---|---|
| **无 Unity 访问** | 策划无需打开 Unity，双击 exe 即可使用全部功能 |
| **数据自动同步** | 配置表通过 Git 提交后，工具自动感知更新，无需手动导出 |
| **多人协作** | 所有策划共享同一数据视图，权重调节结果可保存和分发 |
| **跨项目复用** | 同一套平台工具支持不同游戏项目，只需切换数据源 |
| **可扩展性** | 架构预留深度学习（权重自动推荐、异常检测）接入点 |

---

## 2. 整体架构

```
┌──────────────────────────────────────────────────────────┐
│  datum-platform/  （独立仓库或 Unity 项目同级目录）         │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  DatumCore/  (.NET Standard 2.1 类库)                │ │
│  │  ├── Provider/    IFoeDataProvider + POCO 模型       │ │
│  │  ├── Snapshot/    属性快照构建                        │ │
│  │  ├── Resolver/    属性折算                           │ │
│  │  ├── Metrics/     战斗指标计算                        │ │
│  │  ├── SkillEval/   技能 DPS + 控制评估                 │ │
│  │  ├── Aggregator/  Power Mean 评分聚合                 │ │
│  │  ├── Calibrator/  权重最小二乘校准                    │ │
│  │  └── Template/    模板发现 + 缩放一致性检查            │ │
│  └─────────────────────────────────────────────────────┘ │
│              ↑ 被以下两端同时引用                          │
│  ┌───────────────────┐   ┌───────────────────────────┐   │
│  │  Unity Editor     │   │  DatumServer/             │   │
│  │  (现有 Workbench) │   │  ASP.NET Core 自托管后端   │   │
│  │  引用 DatumCore   │   │  ├── 读取 datum_export/ JSON│  │
│  │  通过 Assembly    │   │  ├── REST API              │   │
│  │  Definition 链接  │   │  ├── WebSocket（实时推送）  │   │
│  └───────────────────┘   │  └── 内嵌前端静态文件       │   │
│                          └───────────────────────────┘   │
│                                    ↓                      │
│                          ┌───────────────────────────┐   │
│                          │  datum-web/               │   │
│                          │  React + Vite + ECharts   │   │
│                          │  + Ant Design             │   │
│                          │  前后端分离开发            │   │
│                          │  发布时嵌入 exe            │   │
│                          └───────────────────────────┘   │
└──────────────────────────────────────────────────────────┘

          datum_export/  ← Unity 侧导出，通过 Git 同步
          ├── monsters.json
          ├── skill_info.json
          ├── skill_blueprints.json
          ├── weight_config.json
          ├── calibration.json
          ├── templates.json
          └── monster_scores.json
```

---

## 3. 目录结构

```
datum-platform/
├── DatumCore/                    # .NET Standard 2.1 纯计算类库
│   ├── Provider/
│   │   ├── IFoeDataProvider.cs
│   │   ├── DatumFoeRow.cs        # POCO 数据模型
│   │   └── JsonFoeDataProvider.cs
│   ├── Snapshot/
│   ├── Resolver/
│   ├── Metrics/
│   ├── SkillEvaluator/
│   ├── Aggregator/
│   ├── Calibrator/
│   ├── Template/
│   └── DatumCore.csproj
│
├── DatumServer/                  # ASP.NET Core 8 自托管后端
│   ├── Controllers/
│   │   ├── MonstersController.cs   # GET /api/monsters
│   │   ├── ScoresController.cs     # GET /api/scores, POST /api/scores/recalc
│   │   ├── WeightsController.cs    # GET/PUT /api/weights
│   │   ├── TemplatesController.cs  # GET /api/templates
│   │   └── CalibrationController.cs
│   ├── Services/
│   │   ├── DatumDataService.cs     # 加载 datum_export/，持有 Provider 实例
│   │   ├── DatumScoreService.cs    # 调用 Core 层计算评分
│   │   └── FileWatcherService.cs   # 监听 datum_export/ 文件变更，热重载
│   ├── Hubs/
│   │   └── DatumHub.cs             # SignalR Hub，推送数据更新通知
│   ├── Models/                     # Request / Response DTO
│   ├── wwwroot/                    # React 构建产物（发布时填充）
│   ├── Program.cs
│   └── DatumServer.csproj          # 引用 DatumCore
│
├── datum-web/                    # React + Vite 前端
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ScoreDashboard/     # 全量评分看板（主页）
│   │   │   ├── MonsterDetail/      # 单怪物详情
│   │   │   ├── TemplateAnalysis/   # 模板缩放分析
│   │   │   ├── LevelView/          # 关卡强度视图
│   │   │   ├── WeightCalibration/  # 权重调节 + 校准
│   │   │   └── HealthReport/       # 数值健康报告
│   │   ├── components/
│   │   │   ├── charts/             # ECharts 封装组件
│   │   │   ├── MonsterCard/
│   │   │   └── WeightSlider/
│   │   ├── api/                    # fetch 封装 + WebSocket 监听
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── datum_export/                 # Unity 导出数据（Git 跟踪）
│   └── （由 DatumExportPipeline 自动生成）
│
├── build.ps1                     # 一键构建脚本（前端 build + 后端 publish）
└── README.md
```

---

## 4. 各层设计详述

### 4.1 DatumCore（类库提取）

从 Unity 项目的 `Assets/Editor/Datum/Core/` 直接迁移，调整点：

- **移除 `using UnityEngine`**（已在 Phase2 完成，Core 层无此依赖）
- **`AttributeResolver` 中的 `MazeAiAttrType` 枚举**：需要一同迁移，或替换为整数常量（可接受）
- **目标框架**：`.NET Standard 2.1`（同时兼容 Unity Mono 和 .NET 8 后端）

Unity 侧通过 **Assembly Definition Reference** 链接到 `DatumCore.dll`，不再维护两份代码。

```
Unity 项目
└── Assets/Editor/Datum/Core/    → 软链接或子模块 → datum-platform/DatumCore/
```

### 4.2 DatumServer（后端）

#### 核心服务：DatumDataService

```csharp
public class DatumDataService
{
    private JsonFoeDataProvider _provider;
    private EvaluationWeightConfig _weights;

    public void LoadFromDirectory(string exportDir)
    {
        // 读取所有 JSON，构建 JsonFoeDataProvider
        var monstersJson   = File.ReadAllText(Path.Combine(exportDir, "monsters.json"));
        var skillInfoJson  = File.ReadAllText(Path.Combine(exportDir, "skill_info.json"));
        var blueprintsJson = File.ReadAllText(Path.Combine(exportDir, "skill_blueprints.json"));
        _provider = new JsonFoeDataProvider(monstersJson, skillInfoJson, blueprintsJson);
    }

    public IReadOnlyList<EntityScore> GetAllScores() { /* 调用 Core 层 */ }
    public EntityScore Recalculate(int configId, EvaluationWeightConfig weights) { /* 单条重算 */ }
}
```

#### 文件监听热重载：FileWatcherService

```csharp
// 监听 datum_export/ 目录变化，自动重载数据并通过 SignalR 推送通知
var watcher = new FileSystemWatcher(exportDir, "*.json");
watcher.Changed += async (_, _) => {
    await _datumService.ReloadAsync();
    await _hub.Clients.All.SendAsync("DataUpdated");
};
```

策划 `git pull` 后，前端自动收到推送并刷新，无需手动操作。

#### REST API 设计

| 方法 | 路径 | 描述 |
|---|---|---|
| GET | `/api/monsters` | 所有怪物基础数据 |
| GET | `/api/scores` | 全量评分（含筛选/排序参数）|
| POST | `/api/scores/recalc` | 传入权重，全量重算评分 |
| GET | `/api/scores/{configId}` | 单怪物评分详情 |
| GET | `/api/weights` | 当前权重配置 |
| PUT | `/api/weights` | 更新权重并保存 |
| GET | `/api/templates` | 模板列表 |
| GET | `/api/templates/{id}/evaluate` | 触发模板评估 |
| GET | `/api/calibration/samples` | 校准样本列表 |
| POST | `/api/calibration/run` | 执行权重校准 |
| GET | `/api/health` | 数值健康报告 |

### 4.3 datum-web（前端）

#### 页面设计

**① 评分看板（ScoreDashboard）**  
全量怪物评分列表 + 散点图（EHP vs DPS）+ 箱线图（各 FoeType 分布）  
支持：关卡筛选 / 类型筛选 / 搜索 / 排序

**② 模板分析（TemplateAnalysis）**  
缩放曲线叠加折线图（多属性不同颜色）+ 变种列表（上行原始值/下行缩放比）  
一致性问题高亮 + 评分缩放 vs 属性缩放对比

**③ 关卡视图（LevelView）**  
按 `barries_id` 分组展示关卡内怪物强度分布  
关卡强度热力图（横轴关卡，纵轴评分分位数）

**④ 权重调节（WeightCalibration）**  
实时权重滑块 → 即时触发后端重算 → 更新评分看板  
主观评分 vs 预测评分散点图 + R² 拟合度 + 一键校准

**⑤ 数值健康报告（HealthReport）**  
异常怪物列表（评分 outlier）/ 模板一致性问题 / 关卡难度曲线是否平滑

#### 技术选型

| 技术 | 用途 |
|---|---|
| React 18 + TypeScript | UI 框架 |
| Vite 5 | 构建工具（极快的热更新）|
| Ant Design 5 | UI 组件库（表格、表单、布局）|
| Apache ECharts 5 | 数据可视化（散点图、折线图、热力图、雷达图）|
| TanStack Query | 数据请求 + 缓存管理 |
| Zustand | 轻量状态管理（当前权重配置等全局状态）|
| SignalR Client | 接收后端数据更新推送 |

---

## 5. 打包与分发

### 5.1 打包产物

```
发布目录/
└── datum-server.exe    ← 单文件，含 .NET 运行时 + 所有 dll + 前端静态文件
```

### 5.2 打包命令

```powershell
# build.ps1 — 一键构建脚本

# Step 1: 构建前端
Set-Location datum-web
npm run build               # 输出 dist/
Set-Location ..

# Step 2: 复制前端产物到后端
Copy-Item -Recurse -Force datum-web/dist/* DatumServer/wwwroot/

# Step 3: 打包后端（单文件，自包含 .NET 运行时）
dotnet publish DatumServer -c Release -r win-x64 `
  --self-contained true `
  -p:PublishSingleFile=true `
  -p:IncludeNativeLibrariesForSelfExtract=true `
  -o ./publish/win-x64

# Step 4: 复制 datum_export/ 到发布目录（首次使用）
Copy-Item -Recurse datum_export publish/win-x64/datum_export

Write-Host "构建完成 → publish/win-x64/datum-server.exe"
```

### 5.3 策划使用流程

```
首次使用：
1. 从共享网盘/Git 获取 datum-server.exe
2. 将 datum_export/ 目录放到 exe 同级（由 git pull 自动维护）
3. 双击 datum-server.exe
4. 浏览器自动打开 http://localhost:7000

日常使用：
1. git pull（datum_export/ 自动更新）
2. 前端页面自动收到 SignalR 推送并刷新（无需重启 exe）
```

### 5.4 跨平台支持

| 平台 | 构建命令 `-r` 参数 | 产物 |
|---|---|---|
| Windows x64 | `win-x64` | `datum-server.exe` |
| macOS Apple Silicon | `osx-arm64` | `datum-server`（可执行文件）|
| macOS Intel | `osx-x64` | `datum-server` |
| Linux x64 | `linux-x64` | `datum-server`（CI 服务器用）|

---

## 6. 数据自动化管道

### 6.1 Git Hook 触发导出

在 Unity 项目的 `.git/hooks/post-commit`（或 `post-merge`）中配置：

```bash
#!/bin/bash
# 检查是否有配置表或技能蓝图改动
if git diff --name-only HEAD~1 HEAD | grep -q "HumanRobotTable\|SkillConfig"; then
  echo "[Datum] 检测到配置表变更，触发数据导出..."
  /path/to/Unity -batchmode -projectPath /path/to/UnityProject \
    -executeMethod HumanRobot.Editor.Datum.DatumExportMenu.ExportAll \
    -quit -logFile datum_export_log.txt
  git add datum_export/
  git commit -m "chore: auto-update datum_export [skip ci]"
fi
```

### 6.2 CI/CD 集成（可选）

```yaml
# .gitlab-ci.yml 或 GitHub Actions
datum-export:
  trigger: 配置表文件变更
  steps:
    - Unity -batchmode -executeMethod DatumExportMenu.ExportAll
    - commit datum_export/ to repo
    - （可选）触发 datum-server 热重载通知
```

---

## 7. 跨项目复用方案

### 7.1 复用机制

不同游戏项目只需实现自己的 `IFoeDataProvider`，Core 层完全不动：

```csharp
// 项目 B 的 Provider（只需实现 3 个方法）
public class ProjectBFoeDataProvider : IFoeDataProvider
{
    public IReadOnlyList<DatumFoeRow> GetAllFoeRows() { /* 读项目 B 的怪物 JSON */ }
    public bool TryGetFoeRow(int configId, out DatumFoeRow row) { /* ... */ }
    public DatumSkillBlueprint GetSkillBlueprint(int skillId) { /* ... */ }
    public DatumSkillInfoRow GetSkillInfoRow(int skillId) { /* ... */ }
}
```

或者直接复用 `JsonFoeDataProvider`，导出时将项目 B 的数据映射到 `DatumFoeRow` 格式。

### 7.2 多项目切换

```
datum-server.exe --data ./datum_export/project_a    ← 项目 A
datum-server.exe --data ./datum_export/project_b    ← 项目 B
```

前端界面完全相同，数据源不同。

### 7.3 字段扩展机制

不同项目可能有 Datum.Core 未包含的属性（如护甲类型、元素克制等）。扩展方案：

```csharp
// DatumFoeRow 预留扩展字段
public class DatumFoeRow
{
    // ... 基础字段 ...
    public Dictionary<string, float> Extensions; // 项目自定义扩展属性
}
```

---

## 8. 深度学习预留接口

当前阶段不实现，但架构上预留接口：

```csharp
// IMlAdvisor — 机器学习建议接口（待实现）
public interface IMlAdvisor
{
    // 根据校准样本推荐权重（替代手动最小二乘）
    Task<WeightRecommendation> RecommendWeightsAsync(IList<CalibrationSample> samples);

    // 检测异常怪物（评分分布异常检测）
    Task<IList<AnomalyReport>> DetectAnomaliesAsync(IList<EntityScore> scores);

    // 预测新怪物的合理评分区间（基于历史数据）
    Task<ScoreInterval> PredictScoreRangeAsync(DatumFoeRow newMonster);
}
```

两种实现路径：

| 路径 | 技术 | 特点 |
|---|---|---|
| **ML.NET**（C# 原生）| Microsoft ML.NET | 直接打进同一个 exe，零额外依赖 |
| **Python 微服务** | FastAPI + PyTorch/sklearn | Python 生态更成熟，与主进程独立部署 |

---

## 9. 实施路线（Phase 3+）

| Phase | 目标 | 关键任务 | 状态 |
|---|---|---|---|
| **Phase 3.1** | DatumCore 独立类库 | `DatumCore.csproj`（.NET Standard 2.1）；所有计算层迁移；`DatumServer` 引用；编译 0 错误 | ✅ 已完成 |
| **Phase 3.2** | DatumServer 基础 API | 读取 `datum_export/` JSON；实现 7 个 API 控制器；`FileWatcherService` 热重载；SignalR Hub | ✅ 已完成 |
| **Phase 3.3** | datum-web 基础框架 | Vite + React 脚手架；5 个页面（评分看板/模板/权重/健康/设置）；ECharts 散点图；前端 `localhost:5173` 运行中 | ✅ 已完成 |
| **Phase 3.4** | 前后端联通 + 示例数据 | 启动 DatumServer；准备 `datum_export/` 示例数据；验证 `/api/health`、`/api/scores` 可返回数据 | 🔄 进行中 |
| **Phase 3.5** | 打包验证 | `build.ps1` 一键构建；`datum-server.exe` 单文件验证；策划端测试 | 🔲 待实施 |
| **Phase 3.6** | 完整功能迭代 | 模板分析图表 / 关卡视图 / 权重实时调节 / UpdateBanner 自动更新 | 🔲 待实施 |
| **Phase 4** | Git Hook 自动化 | `post-commit` 触发 Unity 导出；CI 集成 | 🔲 待实施 |
| **Phase 5** | 跨项目适配 | 第二个项目接入验证；`--data` 参数切换 | 🔲 远期 |
| **Phase 6** | ML 接入 | `IMlAdvisor` 实现（ML.NET 或 Python 微服务）| 🔲 远期 |

---

## 10. 关键技术决策记录（ADR）

### ADR-001：后端选用 ASP.NET Core 而非 Python

- **决策**：后端使用 ASP.NET Core 自托管
- **原因**：Core 计算层已用 C# 实现，直接引用无需重写；.NET 8 支持 self-contained 单文件发布，打包分发成本最低
- **代价**：未来引入 Python ML 框架需要通过 HTTP 调用 Python 微服务

### ADR-002：前端选用 React + ECharts 而非 Blazor

- **决策**：前端使用 React + Vite + ECharts
- **原因**：ECharts 数据可视化能力远优于 Blazor 现有图表库；React 生态和前端开发者更广泛；前后端彻底分离，可独立部署
- **代价**：API 层需要 DTO 序列化，多一层转换

### ADR-003：单 exe 分发而非服务器部署

- **决策**：打包为本地运行的单文件 exe，不部署到服务器
- **原因**：无需运维成本；团队网络环境可能受限；策划本地运行体验更接近原生软件
- **代价**：多人同时看到的数据由各自的 `git pull` 时机决定（通过 Git Hook 自动化降低此影响）

---

---

## 11. 已实现文件清单（Phase 3.1 ~ 3.3）

### DatumCore（.NET Standard 2.1 类库）

```
DatumCore/
├── Provider/
│   ├── IFoeDataProvider.cs       — 数据提供者接口（4个方法）
│   ├── DatumFoeRow.cs            — 怪物/技能/蓝图 POCO 模型
│   └── JsonFoeDataProvider.cs   — JSON 反序列化适配器
├── Snapshot/
│   ├── AttributeSnapshot.cs     — 属性快照（按整数类型索引）
│   └── MonsterSnapshotBuilder.cs — BuildFromRow(DatumFoeRow)
├── Resolver/
│   └── AttributeResolver.cs     — 基础属性 + 加成折算
├── Metrics/
│   ├── CombatMetrics.cs
│   └── CombatMetricsCalculator.cs
├── SkillEvaluator/
│   ├── SkillEvaluator.cs        — DPS + 控制评分
│   └── SkillEvaluationResult.cs
├── Aggregator/
│   ├── EntityScore.cs
│   ├── ScoreAggregator.cs       — Power Mean 聚合
│   └── EvaluationWeightConfig.cs
├── Calibrator/
│   └── WeightCalibrator.cs      — 最小二乘法校准（克拉默法则）
└── Template/
    ├── TemplateModels.cs         — MonsterTemplate / TemplateVariant / Registry
    ├── TemplateDiscovery.cs      — 自动聚类发现
    └── TemplateEvaluator.cs
```

### DatumServer（ASP.NET Core 9.0）

```
DatumServer/
├── Controllers/
│   ├── MonstersController.cs    — GET /api/monsters
│   ├── ScoresController.cs      — GET /api/scores, POST /api/scores/recalc
│   ├── WeightsController.cs     — GET/PUT /api/weights
│   ├── TemplatesController.cs   — GET /api/templates
│   ├── CalibrationController.cs — GET /api/calibration/samples, POST /run
│   ├── HealthController.cs      — GET /api/health
│   └── UpdateController.cs      — GET /api/update/check, POST /apply
├── Services/
│   ├── DatumDataService.cs      — 数据加载 + 缓存 + 重算
│   ├── ScoreCalculator.cs       — 调用 DatumCore 计算全量评分
│   └── FileWatcherService.cs    — datum_export/ 文件变更监听 + 热重载
├── Hubs/
│   └── DatumHub.cs              — SignalR Hub（推送 DataUpdated 事件）
└── Program.cs                   — 启动配置（CORS + SignalR + 静态文件 + SPA fallback）
```

### datum-web（React 18 + Vite 5）

```
datum-web/src/
├── pages/
│   ├── ScoreDashboard/          — 评分看板（统计卡片 + EHP/DPS 散点图 + 排序表格）
│   ├── TemplateAnalysis/        — 模板分析（模板卡片列表）
│   ├── WeightCalibration/       — 权重调节（实时滑块 + 预览重算）
│   ├── HealthReport/            — 数值健康报告
│   └── Settings/                — 系统信息
├── components/
│   └── UpdateBanner.tsx         — 顶部更新提示条（自动检查新版本）
├── routes/AppRoutes.tsx
├── api/client.ts                — axios 封装
├── App.tsx                      — 布局 + 导航 + SignalR 连接
└── main.tsx                     — React 入口（Ant Design 暗色主题）
```

*最后更新：2026-03-02*  
*版本：v1.2 — Phase 3.1/3.2/3.3 完成，前端已运行，后端待联通*
