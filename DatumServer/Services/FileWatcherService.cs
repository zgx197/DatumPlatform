using Datum.Server.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Datum.Server.Services
{
    /// <summary>
    /// 后台服务：监听 datum_export/ 目录的 JSON 文件变化，自动热重载并通知前端。
    /// </summary>
    public class FileWatcherService : BackgroundService
    {
        private readonly DatumDataService _dataService;
        private readonly IHubContext<DatumHub> _hub;
        private readonly ILogger<FileWatcherService> _logger;
        private FileSystemWatcher? _watcher;

        public FileWatcherService(
            DatumDataService dataService,
            IHubContext<DatumHub> hub,
            ILogger<FileWatcherService> logger)
        {
            _dataService = dataService;
            _hub = hub;
            _logger = logger;
        }

        protected override Task ExecuteAsync(CancellationToken stoppingToken)
        {
            var dir = _dataService.DataDir;
            if (!Directory.Exists(dir))
            {
                _logger.LogWarning("[FileWatcher] 数据目录不存在，跳过监听：{Dir}", dir);
                return Task.CompletedTask;
            }

            _watcher = new FileSystemWatcher(dir, "*.json")
            {
                NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size,
                EnableRaisingEvents = true,
            };

            // 防抖：500ms 内多次触发只处理一次
            var debounceTimer = new System.Timers.Timer(500) { AutoReset = false };
            debounceTimer.Elapsed += async (_, _) =>
            {
                _logger.LogInformation("[FileWatcher] 检测到数据变化，热重载中...");
                _dataService.LoadFromDirectory(dir);
                await _hub.Clients.All.SendAsync("DataUpdated", cancellationToken: stoppingToken);
                _logger.LogInformation("[FileWatcher] 热重载完成，已推送通知到前端");
            };

            _watcher.Changed += (_, _) => { debounceTimer.Stop(); debounceTimer.Start(); };
            _watcher.Created += (_, _) => { debounceTimer.Stop(); debounceTimer.Start(); };

            _logger.LogInformation("[FileWatcher] 开始监听目录：{Dir}", dir);
            return Task.CompletedTask;
        }

        public override void Dispose()
        {
            _watcher?.Dispose();
            base.Dispose();
        }
    }
}
