# <img src="datum-web/public/favicon.svg" width="28" height="28" alt="D" /> DatumPlatform

**游戏数值评估平台** — 基于 Unity 导出数据的 Web + 后端数值分析系统，提供怪物评分、权重校准、模板评估、健康报告、关卡难度曲线分析、AI 智能助手等功能，支持数值平衡迭代。

## 架构概览

```
DatumPlatform/
├── datum-web/                 React + Ant Design + ECharts（前端）
│   ├── src/pages/
│   │   ├── ScoreDashboard/       全量评估（难度条、详情面板、异常提示）
│   │   ├── WeightCalibration/    权重校准（滑块、样本管理、最小二乘法）
│   │   ├── TemplateAnalysis/     模板发现 & 评估（列表、柱状图、缩放曲线）
│   │   ├── HealthReport/         健康报告（健康度、问题展开、对比）
│   │   ├── LevelView/            关卡分析（难度曲线、波次、元素分布）
│   │   ├── FormulaDoc/           系统文档（KaTeX + Mermaid）
│   │   └── Settings/             设置（AI 模型、快捷键、Prompt 规则、显示偏好）
│   ├── src/components/
│   │   ├── AiChatDrawer.tsx      AI 助手侧边抽屉（LaTeX / Mermaid / 字体大小）
│   │   ├── MermaidBlock.tsx      Mermaid 流程图组件（共享）
│   │   └── DebugPanel.tsx        调试面板（全局错误捕获）
│   ├── src/services/
│   │   ├── aiChat.ts             AI 聊天（流式 + Function Calling）
│   │   ├── aiConfig.ts           AI 模型管理
│   │   ├── promptRules.ts        Prompt 规则系统（8 条内置 + 自定义）
│   │   ├── uiPrefs.ts            全局 UI 偏好（字体大小等）
│   │   └── shortcuts.ts          快捷键系统
│   └── src/api/                  REST API 客户端
├── DatumServer/                  ASP.NET Core（后端）
│   ├── Controllers/              REST API 接口
│   ├── Services/                 数据加载、校准、文件监听
│   └── app.ico                   应用程序图标
├── DatumCore/                    计算核心（与 Unity 共享，无 Unity 依赖）
│   ├── Aggregator/               综合评分层（加权聚合、Power Mean）
│   ├── Calibrator/               权重校准器（最小二乘法求解）
│   ├── Metrics/                  战斗指标（EHP/DPS/控制 + 分解字段）
│   ├── Provider/                 数据提供者（JsonFoeDataProvider）
│   ├── Resolver/                 属性折算（含元素抗性）
│   ├── SkillEvaluator/           技能评估
│   ├── BuffEvaluator/            Buff 评估（DOT DPS + 控制时长 + 被动EHP修正）
│   ├── Snapshot/                 数据快照
│   ├── Template/                 模板发现与评估
│   └── LevelAggregator/         关卡聚合（难度曲线、弹性分析、元素分布）
├── datum_export/                 Unity 导出的 JSON 数据
├── dev.ps1                       开发启动脚本（自动清理旧进程）
└── build.ps1                     生产构建脚本（单文件 exe）
```

## 功能特性

### 全量评估（ScoreDashboard）
- **难度条**：EHP（蓝）+ DPS（橙）双色可视化
- **右侧详情抽屉**：
  - 综合评分、类型系数
  - **特性标签**：元素抗性、被动Buff、DOT伤害、Buff控制（按特征动态显示）
  - **DPS 分解**：堆叠条（橙=技能DPS，红=DOT DPS）+ 百分比
  - **EHP 修正**：元素抗性因子 + 被动Buff因子
  - **控制分解**：堆叠条（浅绿=技能控制，深绿=Buff控制）
  - 归一化贡献（生存/输出/控制）
- **异常检测**：DPS=0、生存/输出悬殊、控制满值时黄色警告
- **关卡筛选**：下拉按关卡过滤
- **添加到校准**：一键将怪物加入校准样本

### 权重校准（WeightCalibration）
- **样本管理**：每行主观评分滑块 + 数值输入框可实时调整
- **锚点色标**：简单/中等/困难（绿/橙/红）叠加在滑块
- **保存到 calibration.json**：支持增删改样本，持久化到文件
- **最小二乘法校准**：自动求解权重 + R²/MSE + 自然语言解释
- **散点图**：主观 vs 预测评分，残差高亮

### 模板发现 & 评估（TemplateAnalysis）
- **左侧列表导航**：类型/变种数/基准分/一致性状态（✓⚠）
- **变种评分柱状图**：标准行灰色，高于橙色，低于蓝色，偏差%标注
- **缩放曲线图**：属性缩放趋势 + 评分归一化曲线叠加对比
- **一致性问题描述**：逐变种输出属性均值缩放、预期评分 vs 实际偏差%

### 健康报告（HealthReport）
- **整体健康度**：圆形进度条（异常怪物-8分/条，模板问题-5分/条）
- **全局统计**：模板数/已评估/一致性问题/异常怪物
- **跨模板横向对比**：堆叠条形图（基准分 + 最高分溢出）
- **一致性问题展开**：Collapse 逐模板展开，显示具体偏差描述
- **跨模板对比表格**：基准分/最高分/缩放率/变种数/一致性状态

### 关卡分析（LevelView）
- **总览柱状图**：各关卡总难度 + 峰值难度 + 怪物数折线对比
- **关卡卡片**：总难度/怪物数/波次数/峰值难度一览
- **难度曲线**：理论曲线（实线）vs 加速曲线（虚线）双 Y 轴（难度 + 存活数）
- **怪物类型分布**：Boss / 精英 / 普通 饼图
- **元素分布**：从技能蓝图 `DamageElement` 提取的真实元素统计饼图
- **波次详情表格**：每波触发器、延迟、怪物数、波次难度、怪物构成
- **指标卡片**：总难度、峰值难度、平均密度、持续时间、**难度弹性**（加速/理论峰值比）
- **存活时间滑块**：5~120s 动态调整，实时联动后端重算

### AI 智能助手
- **侧边抽屉**：快捷键一键打开（默认 `Alt+A`），支持流式输出 + Markdown 渲染
- **Function Calling**：12 个 Tool Functions，支持查询怪物评分、权重配置、关卡数据等
- **多模型支持**：Kimi / OpenAI / DeepSeek / 自定义，API Key 存浏览器本地
- **LaTeX 公式**：`remark-math` + `rehype-katex`，裸命令自动包裹预处理器，支持中文公式
- **Mermaid 流程图**：代码块自动渲染为 SVG 流程图
- **字体大小调节**：标题栏快捷切换 11~16px，设置页同步

### Prompt 规则系统
- **8 条内置规则**：LaTeX 公式、Mermaid 流程图、表格优先、中文回复、数据驱动、分步分析、异常高亮、简洁模式
- **自定义规则**：新增 / 删除 / 开关管理
- **动态注入**：启用的规则自动追加到 System Prompt

### 系统文档（FormulaDoc）
- **KaTeX 公式渲染**：数学公式实时渲染
- **Mermaid 流程图**：架构图、数据流程自动渲染
- **Markdown 文档**：从 `docs/` 目录加载，支持 GFM 扩展

### 设置页（Settings）
- **显示设置**：AI 聊天字体大小（全局 UI 偏好，双向同步）
- **AI 模型配置**：多模型管理、API Key 安全存储
- **快捷键管理**：7 个内置快捷键，可视化录入覆盖
- **Prompt 规则**：规则列表 + 开关 + 自定义规则编辑

### 调试面板（DebugPanel）
- **全局错误捕获**：console.error / warn / window.onerror / unhandledrejection
- **一键导出**：JSON 格式错误报告，适合 AI 辅助分析
- **噪音过滤**：自动过滤 KaTeX Unicode 警告等已知噪音

## 快速开始

### 1. 数据准备
在 Unity 项目中：
```bash
# 打开 Unity，菜单：Datum / Export Json
# 选择输出目录（建议：d:\work\DatumPlatform\datum_export）
# 点击「导出全部 JSON」
```

### 2. 一键启动（推荐）

```powershell
# 在 DatumPlatform 根目录执行：
.\dev.ps1

# 指定数据目录：
.\dev.ps1 -Data "D:\work\DatumPlatform\datum_export"

# 跳过编译（代码未修改时，启动更快）：
.\dev.ps1 -SkipBuild

# 仅启动后端（用于调试 API）：
.\dev.ps1 -BackendOnly

# 仅启动前端（后端已单独运行）：
.\dev.ps1 -FrontendOnly
```

`dev.ps1` 会自动：编译后端 → 启动后端服务（端口 7000）→ 启动前端开发服务器（端口 5173）→ 打开浏览器到关卡分析页面。

### 2b. 手动启动（备选）

**后端：**
```bash
cd d:\work\DatumPlatform\DatumServer
dotnet run -- --data "d:\work\DatumPlatform\datum_export"
# 访问：http://localhost:7000
```

**前端：**
```bash
cd d:\work\DatumPlatform\datum-web
npm install
npm run dev
# 访问：http://localhost:5173
```

## 数据流

```
Unity 项目 ──► Export Json ──► datum_export/*.json ──► DatumServer (JsonFoeDataProvider)
    │
    ▼
DatumCore（计算核心，无 Unity 依赖）
    │
    ▼
datum-web（React 前端）
```

- **Unity → JSON**：`DatumExportPipeline` 读取 `HumanRobotTableData`、`SkillConfigAsset`、ScriptableObject 配置，导出为 JSON。
- **JSON → Core**：`DatumServer` 启动时加载 JSON，通过 `JsonFoeDataProvider` 供给计算层。
- **Core → Web**：REST API 返回结构化数据，前端渲染为交互式图表与表格。

## 开发指南

### 后端扩展
- 新增 API：在 `DatumServer/Controllers` 添加 Controller，注入 `DatumDataService`。
- 新增计算逻辑：在 `DatumCore` 下新增模块，保持无 Unity 依赖。

### 前端扩展
- 新增页面：在 `src/pages` 添加组件，使用 `useQuery` 调用 `datumApi`。
- 新增图表：使用 `echarts-for-react`，参考现有页面的 `option` 写法。

### 数据格式
- **monsters.json**：怪物基础数据（`DatumFoeRow`，含 `PassiveSkillIds`）
- **skill_info.json**：技能基础配置（`DatumSkillInfoRow`，含 `SelfEffectBuffIds`）
- **skill_blueprints.json**：技能蓝图（`DatumSkillBlueprint` + `DatumHitPoint`，含 `DamageElement` + `AttachedBuffIds`）
- **buff_configs.json**：Buff 配置（`DatumBuffConfigRow`，DOT/控制/效果组）
- **weight_config.json**：权重配置（`WeightConfig`）
- **calibration.json**：校准样本（`CalibrationSample`）
- **templates.json**：模板注册表（`MonsterTemplate`）
- **monster_scores.json**：预计算评分（`EntityScore`）
- **level_structure.json**：关卡结构（`LevelStructure`，含触发器、波次、时间轴、预设怪物）

### 字段名约定
- Unity 导出与后端反序列化采用 **snake_case**（如 `survival_weight`）
- 前端 TypeScript 接口与后端 DTO 保持一致
- 避免驼峰与下划线混用，减少映射错误

## 打包分发

```powershell
# 一键构建（产出单文件 exe + 前端 + 数据）
.\build.ps1

# 指定目标平台
.\build.ps1 -Runtime osx-arm64
.\build.ps1 -Runtime linux-x64

# 跳过前端构建
.\build.ps1 -SkipFrontend
```

产出 `publish/win-x64/DatumServer.exe`（~47 MB 单文件），双击即用，前端静态资源嵌入 `wwwroot/`。

## 技术栈

- **前端**：React 18 + TypeScript + Ant Design 5 + ECharts + TanStack Query
- **AI 渲染**：remark-math + rehype-katex（LaTeX）、Mermaid（流程图）、ReactMarkdown（Markdown）
- **后端**：ASP.NET Core 9 + System.Text.Json + SignalR + 文件监听
- **计算核心**：C#（无 Unity 依赖），与 Unity 项目共享代码
- **打包**：dotnet publish（单文件 self-contained exe）+ Vite build
- **数据格式**：JSON（UTF‑8），字段名 snake_case