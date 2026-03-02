# Datum Platform — 跨项目数值分析平台设计文档

> **文档版本**：v3.1  
> **创建时间**：2026-03-02  
> **最后更新**：2026-03-02  
> **状态**：**Phase 3 + 元素/Buff + 关卡维度完成** — 后端 API + 5 个前端页面 + BuffEvaluator + LevelAggregator + 调试面板  
> **文档位置**：`D:\work\DatumPlatform\docs\`  
> **前置文档**：`Datum_Design.md`（Unity 侧 `Documentations~/`，核心评估框架历史设计）

---

## 1. 背景与目标

### 1.1 现状

Datum 最初以 Unity Editor 插件形式运行（v1.0~v4.0），现已完成平台化迁移：

- **Unity 侧**：仅保留 `Export/`（`Datum / Export Json` 菜单），旧版 Workbench（5 Tab）已全部删除
- **DatumPlatform**：独立的 ASP.NET Core 后端 + React 前端，完整实现评分看板、权重校准、模板分析、健康报告
- **DatumCore**：纯 C# 计算类库（无 Unity 依赖），后端直接引用

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
┌─────────────────────────────────────────────────────────────────┐
│  Unity 项目（仅导出）                                             │
│  Assets/Editor/Datum/Export/                                      │
│  ├── DatumExportPipeline.cs    导出管道                           │
│  └── DatumExportWindow.cs      菜单 Datum/Export Json             │
│                    │                                              │
│                    ▼  导出 JSON                                    │
│           datum_export/*.json ──────────────────┐                 │
└─────────────────────────────────────────────────│─────────────────┘
                                                  │
┌─────────────────────────────────────────────────│─────────────────┐
│  DatumPlatform/                                 ▼                 │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  DatumCore/  (.NET 9.0 类库，无 Unity 依赖)                  │ │
│  │  ├── Provider/    IFoeDataProvider + JsonFoeDataProvider     │ │
│  │  ├── Snapshot/    属性快照构建                                │ │
│  │  ├── Resolver/    属性折算                                   │ │
│  │  ├── Metrics/     战斗指标计算（EHP/DPS/控制）                │ │
│  │  ├── SkillEval/   技能 DPS + 控制评估                        │ │
│  │  ├── BuffEvaluator/ DOT DPS + 控制时长 + 被动EHP修正       │ │
│  │  ├── Aggregator/  Power Mean 评分聚合                        │ │
│  │  ├── Calibrator/  权重最小二乘校准                            │ │
│  │  └── Template/    模板发现 + 缩放一致性检查                   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          ↑ 引用                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  DatumServer/  (ASP.NET Core 自托管后端)                     │ │
│  │  ├── Controllers/   REST API（7 个控制器）                   │ │
│  │  ├── Services/      DatumDataService + FileWatcherService    │ │
│  │  └── Hubs/          SignalR（实时推送数据更新）               │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                          ↓ REST API                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  datum-web/  (React 18 + Vite + Ant Design + ECharts)       │ │
│  │  ├── ScoreDashboard/     全量评估（难度条 + 详情 + 异常）    │ │
│  │  ├── WeightCalibration/  权重校准（滑块 + 样本管理 + R²）   │ │
│  │  ├── TemplateAnalysis/   模板分析（列表 + 柱状图 + 曲线）   │ │
│  │  └── HealthReport/       健康报告（健康度 + 对比 + 展开）   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  datum_export/  ← Unity 导出 + Git 同步                           │
│  ├── monsters.json          怪物基础数据（+PassiveSkillIds）           │
│  ├── skill_info.json        技能基础配置（+SelfEffectBuffIds）       │
│  ├── skill_blueprints.json  技能蓝图（+DamageElement+AttachedBuffIds）│
│  ├── buff_configs.json      Buff 配置（DOT/控制/效果组）          │
│  ├── weight_config.json     权重配置                              │
│  ├── calibration.json       校准样本                              │
│  ├── templates.json         模板注册表                            │
│  └── monster_scores.json    预计算评分结果                        │
└───────────────────────────────────────────────────────────────────┘
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
│   ├── BuffEvaluator/          # DOT DPS + 控制时长 + 被动EHP修正
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
        var buffCfgJson    = File.ReadAllText(Path.Combine(exportDir, "buff_configs.json"));
        _provider = new JsonFoeDataProvider(monstersJson, skillInfoJson, blueprintsJson, buffCfgJson);
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
| PUT | `/api/calibration/samples` | 保存校准样本（持久化到 calibration.json） |
| POST | `/api/calibration/run` | 执行权重校准 |
| GET | `/api/health` | 数值健康报告 |

### 4.3 datum-web（前端）

#### 页面设计（已全部实现）

**① 全量评估（ScoreDashboard）** ✅  
- EHP/DPS **双色难度条**（蓝/橙，hover 显示数值）
- 点击任意行弹出**右侧详情抽屉**：
  - 综合评分、类型系数
  - **特性标签**：元素抗性（cyan）、被动Buff（purple）、DOT伤害（volcano）、Buff控制（green）
  - **DPS 分解**：堆叠条形图（橙=技能DPS，红=DOT DPS）+ 百分比 + 原始值
  - **EHP 修正**：元素抗性因子 + 被动Buff因子，高亮非默认值
  - **控制分解**：堆叠条形图（浅绿=技能控制，深绿=Buff控制）
  - 归一化贡献（生存/输出/控制）
- **异常检测**：DPS=0、生存/输出悬殊 10x、控制满值时显示黄色 ⚠ 图标 + 详情
- **关卡筛选**下拉
- 详情面板内**"添加到校准样本"**按钮（直接调后端保存）

**② 模板分析（TemplateAnalysis）** ✅  
- **左侧列表导航**：类型/变种数/基准分/一致性状态（✓⚠）
- **变种评分柱状图**：标准行灰色，高于橙色，低于蓝色，偏差%标注
- **缩放曲线图**：属性缩放趋势 + 评分归一化曲线叠加对比
- **一致性问题描述**：逐变种输出属性均值缩放、预期评分 vs 实际偏差%

**③ 权重校准（WeightCalibration）** ✅  
- **权重滑块**：实时调节生存/输出/控制权重 → 后端重算
- **样本管理**（SamplesPanel）：每行主观评分滑块 + 数值输入框可实时调整
- 锚点色标（简单=绿/中等=橙/困难=红）叠加在滑块
- **保存/删除**样本（带确认弹窗），持久化到 `calibration.json`
- **最小二乘法校准**：自动求解权重 + R²/MSE + 自然语言解释
- **散点图**：主观 vs 预测评分

**④ 数值健康报告（HealthReport）** ✅  
- **整体健康度**：圆形进度条（异常怪物-8分/条，模板问题-5分/条）
- **全局统计**：模板数/已评估/一致性问题/异常怪物
- **跨模板横向对比**：堆叠条形图（基准分 + 最高分溢出）
- **一致性问题 Collapse 展开**：逐模板展开查看变种偏差描述
- **跨模板对比表格**：基准分/最高分/缩放率/变种数/一致性状态

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

## 9. 实施路线

| Phase | 目标 | 关键任务 | 状态 |
|---|---|---|---|
| **Phase 3.1** | DatumCore 独立类库 | `DatumCore.csproj`（.NET 9.0）；所有计算层迁移；`DatumServer` 引用；编译 0 错误 | ✅ 已完成 |
| **Phase 3.2** | DatumServer 基础 API | 读取 `datum_export/` JSON；7 个 API 控制器；`FileWatcherService` 热重载；SignalR Hub | ✅ 已完成 |
| **Phase 3.3** | datum-web 基础框架 | Vite + React 脚手架；4 个页面（评分看板/权重校准/模板分析/健康报告）；ECharts 图表 | ✅ 已完成 |
| **Phase 3.4** | 前后端联通 | 启动 DatumServer + datum-web；验证全部 API 可返回数据；TypeScript 0 错误 | ✅ 已完成 |
| **Phase 3.5** | 前端功能增强 | ScoreDashboard（难度条+详情+异常+关卡筛选+添加到校准）；WeightCalibration（样本编辑+保存）；TemplateAnalysis（列表+柱状图+曲线+一致性）；HealthReport（健康度+对比+展开） | ✅ 已完成 |
| **Phase 3.6** | Unity 侧清理 | 删除 Windows/Calibrator/Template/DatumContext 等旧代码；仅保留 Export；更新 README 和设计文档 | ✅ 已完成 |
| **Phase 6a** | 元素/Buff 维度集成 | BuffEvaluator + 元素抗性修正 + DPS/控制分解 + 前端可视化增强 | ✅ 已完成 |
| **Phase 6b** | 关卡维度聚合 | LevelAggregator（波次聚合 + 难度曲线 + 加速曲线）；LevelView 前端页面；`level_structure.json` 导出 | ✅ 已完成 |
| **Phase 6c** | 调试体验 + Bug 修复 | DebugPanel（全局错误捕获 + AI 友好导出）；calibration.json 字段兼容；wave duplicate key 修复；antd 静态 API 修复 | ✅ 已完成 |
| **Phase 6d** | 易用性优化 + 数据导出 + 系统文档 | WorkflowGuide 工作流引导；关键指标 Tooltip 说明；校准样本自动预填分；difficulty-tiers API；系统文档页（KaTeX + Mermaid） | ✅ 已完成 |
| **Phase 6e** | AI 助手 + 快捷键系统 | AI 助手：前端直连 Kimi/OpenAI/DeepSeek API（Function Calling）；12 个 Tool Functions；API Key 存 localStorage；流式输出 + Markdown 渲染；侧边抽屉 + 思考动画 + Tool 状态。快捷键系统：7 个内置快捷键（AI/调试/页面跳转）；设置页可视化编辑 + 录入覆盖 + 恢复默认；配置存 localStorage。Bug 修复：Spin tip 警告、setState during render、SignalR 噪音过滤 | ✅ 已完成 |
| **Phase 6f** | Prompt 规则 + AI 聊天增强 + 显示设置 + Bug 修复 | Prompt 规则系统：8 条内置规则（LaTeX/Mermaid/表格/中文/数据驱动/分步/异常高亮/简洁）；自定义规则；动态注入 System Prompt。AI 聊天增强：LaTeX 公式渲染（remark-math + rehype-katex + 裸命令预处理器 + strict:false 中文支持）；Mermaid 流程图渲染（共享 MermaidBlock 组件）。显示设置：uiPrefs 全局偏好服务；AI 聊天字体大小切换（标题栏快捷 + 设置页双向同步）；存 localStorage。Bug 修复：DebugPanel 过滤 unicodeTextInMathMode 噪音；dev.ps1 PID 文件机制（防止 cmd 窗口累积） | ✅ 已完成 |
| **Phase 4** | Git Hook 自动化 | `post-commit` 触发 Unity 导出；CI 集成 | � 待实施 |
| **Phase 5** | 打包与分发 | `build.ps1` 一键构建；`datum-server.exe` 单文件验证；策划端测试 | 🔲 待实施 |
| **Phase 7** | 跨项目适配 | 第二个项目接入验证；`--data` 参数切换 | 🔲 远期 |
| **Phase 8** | ML 接入 | `IMlAdvisor` 实现（ML.NET 或 Python 微服务）| 🔲 远期 |

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
│   ├── ScoreDashboard/          — 全量评估（难度条 + 详情抽屉 + 异常检测 + 关卡筛选 + 添加到校准）
│   ├── WeightCalibration/       — 权重校准（滑块 + SamplesPanel 样本管理 + 校准 + 散点图）
│   ├── TemplateAnalysis/        — 模板分析（左侧列表 + 评分柱状图 + 缩放曲线 + 一致性问题）
│   ├── HealthReport/            — 健康报告（健康度 + 统计 + 跨模板对比 + Collapse 展开）
│   └── Settings/                — 系统信息
├── types/
│   └── datum.ts                 — TypeScript 类型定义（EntityScore/WeightConfig/MonsterTemplate 等）
├── api/
│   └── datum.ts                 — REST API 客户端（axios 封装）
├── App.tsx                      — 布局 + 导航 + SignalR 连接
└── main.tsx                     — React 入口（Ant Design 暗色主题）
```

---

## 12. 未来演进方向（Phase 6）

> 以下是 Datum 评估框架的深度功能演进方向，当前均为规划阶段，按优先级和收益排序。
> 这些方向将在 DatumPlatform 中实现，不再回到 Unity 侧。

### ~~12.1 方向 A：元素维度纳入~~ ✅ 已完成

已在 Phase 6a 实现：元素抗性修正 EHP（`ElementResistanceFactor = 1 + avgRes/10000`），打击点元素类型导出（`DamageElement`）。

### ~~12.2 方向 B：Buff 维度~~ ✅ 已完成

已在 Phase 6a 实现：`BuffEvaluator` 模块（DOT DPS + 控制时长 + 被动 EHP 修正），新增 `buff_configs.json` 导出。详见 `Datum_Design.md` 第 11 节。

### ~~12.3 方向 C：关卡维度聚合升级~~ ✅ 已完成

已在 Phase 6b 实现：

- `DatumCore/LevelAggregator/` — `LevelAggregator`（波次聚合 + 难度曲线 + 加速曲线 + 元素分布）
- `LevelsController.cs` — `GET /api/levels/structures`、`GET /api/levels/metrics`、`GET /api/levels/metrics/{id}`
- `LevelView` 前端页面 — 关卡列表 + 难度曲线（理论/加速双曲线）+ 波次详情表格 + 元素/类型分布饼图
- `level_structure.json` — Unity 侧导出波次结构（触发器 → 波次 → 怪物列表）
- **已修复**：同一 `triggerId` 多配置行导致的波次三元组重复，`LevelAggregator` 按 `(regionId, triggerId, waveIndex)` 合并

### 12.4 方向 D：蒙特卡洛仿真（Slow Evaluator）

**现状**：所有计算都是解析公式（Fast Evaluator），无法处理随机性（暴击、闪避、概率触发的 Buff）。

**设计思想**（详见 `Datum_Design.md` 第 2.2 节双评估器架构）：
```
Fast Evaluator（当前已实现）
  解析公式 → 毫秒级，用于实时显示
  输出：近似评分

Slow Evaluator（蒙特卡洛仿真）
  简化战斗仿真 × N 轮
  输出：TTK/TTS 统计分布（均值 ± 标准差，P50/P95）
```

**实现思路**：
- 构建**简化版战斗仿真器**（不需要完整帧同步，只需攻防回合制模拟）
- 模拟 N 轮（如 1000 轮），统计 TTK（击杀时间）/ TTS（生存时间）分布
- 考虑暴击率/暴击伤害、闪避率、格挡率、元素抗性等随机因素
- 输出置信区间：`Score = mean ± 1.96σ`
- 仿真结果可用于自动校准权重（替代手动标注 + 最小二乘法）

**架构位置**：
- 后端新增 `DatumCore/Simulator/` 模块
- REST API 新增 `POST /api/simulate` 接口
- 前端新增仿真结果可视化（TTK 分布直方图、置信区间条）

**难点**：工作量最大，需要复刻伤害公式链、暴击逻辑、闪避逻辑。

**收益**：最高但最远。能处理所有随机性，提供置信区间，并可用于校准权重。

**工作量**：1 周+。

### 12.5 优先级排序

| 优先级 | 方向 | 工作量 | 状态 |
|---|---|---|---|
| ~~**P1**~~ | ~~A：元素维度~~ | ~~1-2天~~ | ✅ 已完成 |
| ~~**P1**~~ | ~~C：关卡维度~~ | ~~3-4天~~ | ✅ 已完成 |
| ~~**P2**~~ | ~~B：Buff 维度~~ | ~~4-5天~~ | ✅ 已完成 |
| **P3** | D：蒙特卡洛仿真 | 1周+ | 🔲 远期目标 |

### 12.6 各方向对评分管线的影响

```
当前管线：
Snapshot → Resolver → Metrics(EHP/DPS/Control) → SkillEval → Aggregator → Score

方向 A（元素）：
  影响 Metrics 层 — DPS 计算增加元素修正
  影响 SkillEval — 读取技能元素类型
  导出扩展：skill_blueprints.json + ElementType

方向 B（Buff）：
  影响 SkillEval — 新增 Buff 效果解析
  影响 Metrics 层 — DPS/EHP/Control 均可能受 Buff 修正
  导出扩展：skill_blueprints.json + AttachedBuffs[]

方向 C（关卡）：
  不影响现有管线 — 在 Score 之上新增聚合层
  新增：LevelAggregator（波次结构 + 同时在场叠加）
  导出扩展：新增 level_structure.json

方向 D（仿真）：
  与现有管线并行 — 独立的 Slow Evaluator
  新增：Simulator 模块（攻防回合制 × N 轮蒙特卡洛）
  可替代 Aggregator 的权重校准数据源
```

---

*最后更新：2026-03-02*  
*版本：v3.7 — Phase 6f 完成（Prompt 规则 + LaTeX/Mermaid 渲染 + 字体大小设置 + KaTeX 中文 Unicode 修复 + dev.ps1 终端殘留修复）*
