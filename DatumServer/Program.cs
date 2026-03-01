using Datum.Server.Hubs;
using Datum.Server.Services;

var builder = WebApplication.CreateBuilder(args);

// ── 服务注册 ──────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.AddSingleton<DatumDataService>();
builder.Services.AddHostedService<FileWatcherService>();
builder.Services.AddOpenApi();

// 开发期允许前端 5173 端口跨域访问
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

var app = builder.Build();

// ── 中间件管道 ────────────────────────────────────────────
if (app.Environment.IsDevelopment())
    app.MapOpenApi();

app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();
app.MapHub<DatumHub>("/hubs/datum");

// SPA fallback：所有未匹配路由返回 index.html（前端路由用）
app.MapFallbackToFile("index.html");

// ── 读取 datum_export/ 数据目录（支持命令行 --data 参数）────
var dataService = app.Services.GetRequiredService<DatumDataService>();
var dataDir = args.Length > 1 && args[0] == "--data"
    ? args[1]
    : Path.Combine(AppContext.BaseDirectory, "datum_export");
dataService.LoadFromDirectory(dataDir);

Console.WriteLine($"[DatumServer] 已启动，数据目录：{dataDir}");
Console.WriteLine($"[DatumServer] 访问地址：http://localhost:7000");

app.Run("http://localhost:7000");
