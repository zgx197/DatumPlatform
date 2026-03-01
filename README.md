# DatumPlatform

**游戏数值评估平台** — 基于 Unity 导出数据的 Web + 后端数值分析系统，提供怪物评分、权重校准、模板评估、健康报告等功能，支持数值平衡迭代与关卡难度曲线分析。

## 架构概览

```
DatumPlatform/
├── datum-web/              React + Ant Design + ECharts（前端）
│   ├── src/pages/
│   │   ├── ScoreDashboard/     全量评估（难度条、详情面板、异常提示、添加到校准）
│   │   ├── WeightCalibration/  权重校准（滑块、样本管理、最小二乘法、R²）
│   │   ├── TemplateAnalysis/   模板发现 & 评估（左侧列表、评分柱状图、缩放曲线、一致性）
│   │   └── HealthReport/       健康报告（整体健康度、问题展开、跨模板对比）
│   └── src/api/                 REST API 客户端
├── DatumServer/               ASP.NET Core（后端）
│   ├── Controllers/            REST API 接口
│   ├── Services/               数据加载、校准、文件监听
│   └── DatumCore/             计算核心（与 Unity 共享，无 Unity 依赖）
│       ├── Aggregator/         综合评分层（加权聚合、Power Mean）
│       ├── Calibrator/         权重校准器（最小二乘法求解）
│       ├── Metrics/            战斗指标（EHP/DPS/控制）
│       ├── Provider/           数据提供者（JsonFoeDataProvider）
│       ├── Resolver/           属性折算
│       ├── SkillEvaluator/     技能评估
│       ├── Snapshot/           数据快照
│       └── Template/           模板发现与评估
└── datum_export/               Unity 导出的 JSON 数据（由 Unity 项目生成）
```

## 功能特性

### 全量评估（ScoreDashboard）
- **难度条**：EHP（蓝）+ DPS（橙）双色可视化
- **右侧详情抽屉**：综合评分、类型系数、EHP/DPS/控制三段进度条、贡献分解
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

## 快速开始

### 1. 数据准备
在 Unity 项目中：
```bash
# 打开 Unity，菜单：Datum / Export Json
# 选择输出目录（建议：d:\work\DatumPlatform\datum_export）
# 点击「导出全部 JSON」
```

### 2. 启动后端
```bash
cd d:\work\DatumPlatform\DatumServer
dotnet run -- --data "d:\work\DatumPlatform\datum_export"
# 访问：http://localhost:7000
```

### 3. 启动前端
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
- **monsters.json**：怪物基础数据（`DatumFoeRow`）
- **skill_info.json**：技能基础配置（`DatumSkillInfoRow`）
- **skill_blueprints.json**：技能蓝图（`DatumSkillBlueprint` + `DatumHitPoint`）
- **weight_config.json**：权重配置（`WeightConfig`）
- **calibration.json**：校准样本（`CalibrationSample`）
- **templates.json**：模板注册表（`MonsterTemplate`）
- **monster_scores.json**：预计算评分（`EntityScore`）

### 字段名约定
- Unity 导出与后端反序列化采用 **snake_case**（如 `survival_weight`）
- 前端 TypeScript 接口与后端 DTO 保持一致
- 避免驼峰与下划线混用，减少映射错误

## 技术栈

- **前端**：React 18 + TypeScript + Ant Design 5 + ECharts + TanStack Query
- **后端**：ASP.NET Core 8 + System.Text.Json + 文件监听
- **计算核心**：C#（无 Unity 依赖），与 Unity 项目共享代码
- **数据格式**：JSON（UTF‑8），字段名 snake_case