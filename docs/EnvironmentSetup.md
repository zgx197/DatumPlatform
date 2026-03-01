# DatumPlatform — 开发环境配置指南

> **适用系统**：Windows 10/11  
> **最后更新**：2026-03-02

---

## 1. 已确认安装的环境

| 工具 | 版本 | 状态 |
|---|---|---|
| .NET SDK | 9.0.202 | ✅ 已安装 |
| Git | 2.45.1 | ✅ 已安装 |
| Node.js | — | ❌ 需要安装 |
| npm | — | ❌ 随 Node.js 一同安装 |

---

## 2. 需要安装的环境

### 2.1 Node.js（前端必须）

**下载地址**：https://nodejs.org/  
**推荐版本**：LTS 版本（当前为 22.x）

安装完成后验证：
```powershell
node --version   # 应输出 v22.x.x
npm --version    # 应输出 10.x.x
```

> Node.js 安装包自带 npm，无需单独安装。

---

## 3. Windsurf 编辑器插件

打开 Windsurf → Extensions（扩展面板），搜索并安装以下插件：

### 3.1 必装插件

| 插件名 | 用途 |
|---|---|
| **C# Dev Kit** | C# / ASP.NET Core 开发支持（IntelliSense、调试、测试）|
| **.NET Install Tool** | 自动管理 .NET SDK 版本 |
| **ESLint** | TypeScript/React 代码质量检查 |
| **Prettier** | 代码格式化（前端统一风格）|

### 3.2 推荐插件

| 插件名 | 用途 |
|---|---|
| **GitLens** | Git 历史增强，查看每行代码的提交记录 |
| **Git Graph** | 可视化 Git 分支图 |
| **Thunder Client** | 轻量 REST API 测试工具（测试后端 API）|
| **vscode-icons** | 文件图标美化，方便区分 `.cs`、`.tsx`、`.json` 文件 |
| **Tailwind CSS IntelliSense** | 如果后续前端使用 Tailwind（当前方案用 Ant Design，暂时可不装）|

### 3.3 安装方式

```
Ctrl + Shift + X  → 搜索插件名 → Install
```

---

## 4. 项目初始化（首次）

克隆仓库后，执行以下命令初始化各子项目依赖：

```powershell
# 前端依赖
cd datum-web
npm install

# 后端依赖（.NET 会自动 restore）
cd ../DatumServer
dotnet restore
```

---

## 5. 日常开发启动

```powershell
# 终端 1：启动后端
cd DatumServer
dotnet run

# 终端 2：启动前端开发服务器
cd datum-web
npm run dev
# 浏览器访问 http://localhost:5173
```

---

## 6. 自动更新方案（"检查更新"按钮）

这是一个重要的用户体验需求：策划希望像其他软件一样有"检查更新"并一键更新的能力。

### 6.1 核心思路

`datum-server.exe` 在启动时（或用户点击"检查更新"时）：
1. 请求一个远程版本文件（放在内网服务器或 Git 仓库中）
2. 比对当前版本号与最新版本号
3. 如果有更新，下载新的 `datum-server.exe` 并替换

### 6.2 实现方案

#### 方案 A：自更新 exe（推荐，最简单）

后端内置更新检查逻辑，前端提供"检查更新"按钮：

**版本文件**（放在 Git 仓库或内网文件服务器，如 `\\内网服务器\datum\version.json`）：
```json
{
  "version": "1.2.0",
  "releaseDate": "2026-03-02",
  "downloadUrl": "\\\\内网服务器\\datum\\datum-server-1.2.0.exe",
  "releaseNotes": "新增关卡视图、修复权重校准计算"
}
```

**后端更新检查逻辑**（`UpdateService.cs`）：
```csharp
public class UpdateService
{
    private const string VERSION_FILE_URL = @"\\内网服务器\datum\version.json";
    private const string CURRENT_VERSION = "1.1.0";  // 编译时写入

    public async Task<UpdateInfo?> CheckForUpdateAsync()
    {
        var json = await File.ReadAllTextAsync(VERSION_FILE_URL);
        var info = JsonSerializer.Deserialize<UpdateInfo>(json);
        if (Version.Parse(info.Version) > Version.Parse(CURRENT_VERSION))
            return info;
        return null;  // 无更新
    }

    public async Task DownloadAndApplyUpdateAsync(string downloadUrl)
    {
        var tempExe = Path.GetTempFileName() + ".exe";
        File.Copy(downloadUrl, tempExe, overwrite: true);

        // 写一个 bat 脚本：等待当前进程退出后替换 exe 并重启
        var batScript = $@"
@echo off
timeout /t 2 /nobreak >nul
copy /Y ""{tempExe}"" ""{Environment.ProcessPath}""
start """" ""{Environment.ProcessPath}""
del ""%~f0""
";
        var batPath = Path.Combine(Path.GetTempPath(), "datum_update.bat");
        await File.WriteAllTextAsync(batPath, batScript);
        Process.Start(new ProcessStartInfo(batPath) { CreateNoWindow = true });
        Environment.Exit(0);  // 退出当前进程，bat 脚本接管替换
    }
}
```

**前端更新通知**（前端启动后通过 API 查询）：
```typescript
// 启动时检查更新
const { data: updateInfo } = useQuery({
  queryKey: ['update-check'],
  queryFn: () => fetch('/api/update/check').then(r => r.json()),
  staleTime: 1000 * 60 * 30,  // 30分钟检查一次
});

// 有更新时显示顶部通知条
if (updateInfo?.hasUpdate) {
  return (
    <Alert
      message={`发现新版本 ${updateInfo.version}：${updateInfo.releaseNotes}`}
      action={<Button onClick={handleUpdate}>立即更新</Button>}
    />
  );
}
```

**用户体验效果**：
```
策划打开工具 → 右上角出现"发现新版本 1.2.0"通知
→ 点击"立即更新"
→ 自动下载并替换 exe
→ 工具自动重启，更新完成
（整个过程约 10-30 秒，完全无感）
```

#### 方案 B：Git Pull 更新数据 + 手动替换 exe（更简单，但体验差一点）

- **数据更新**（配置表 JSON）：由 Git Hook 自动提交，策划 `git pull` 后前端自动感知（SignalR 推送）
- **程序更新**（exe 本体）：在共享网盘放最新 exe，更新时覆盖替换

这种方式数据和程序分开更新，实现零成本，但不够"一键"。

### 6.3 推荐策略

| 更新类型 | 推荐方式 | 频率 |
|---|---|---|
| **数据更新**（配置表 JSON）| Git Hook 自动提交 + SignalR 推送 → 无感刷新 | 每次配置表提交 |
| **程序更新**（exe 本体）| 方案 A 自更新机制 | 功能迭代时（每周/每月）|

### 6.4 版本号管理

在 `DatumServer.csproj` 中统一管理版本：
```xml
<PropertyGroup>
  <Version>1.0.0</Version>
  <AssemblyVersion>1.0.0.0</AssemblyVersion>
</PropertyGroup>
```

程序启动时自动读取：
```csharp
var version = Assembly.GetExecutingAssembly()
    .GetName().Version!.ToString(3);  // "1.0.0"
```

---

## 7. 技术栈汇总（当前项目）

### 后端
| 技术 | 版本 | 用途 |
|---|---|---|
| .NET | 9.0 | 运行时 |
| ASP.NET Core | 9.0 | Web 框架（自托管）|
| SignalR | 内置 | WebSocket 实时推送 |
| System.Text.Json | 内置 | JSON 序列化 |

### 前端
| 技术 | 版本 | 用途 |
|---|---|---|
| Node.js | 22.x LTS | 运行时 |
| React | 18 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5 | 构建工具 |
| Ant Design | 5 | UI 组件库 |
| Apache ECharts | 5 | 数据可视化 |
| TanStack Query | 5 | 数据请求 + 缓存 |
| Zustand | 4 | 全局状态管理 |
| @microsoft/signalr | 8 | SignalR 客户端 |

---

## 8. 快速检查清单

完成环境配置后，依次验证：

```powershell
# 1. Node.js 安装完成
node --version   # v22.x.x

# 2. .NET 正常（已确认）
dotnet --version # 9.0.202

# 3. Git 正常（已确认）
git --version    # 2.45.1

# 4. 前端依赖安装完成
cd datum-web && npm run dev   # 应在 5173 端口启动

# 5. 后端启动正常
cd DatumServer && dotnet run  # 应在 7000 端口启动

# 6. API 可访问
curl http://localhost:7000/api/health  # {"status":"ok"}
```

---

*最后更新：2026-03-02*
