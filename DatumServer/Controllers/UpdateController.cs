using Microsoft.AspNetCore.Mvc;
using System.Reflection;
using System.Text.Json;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UpdateController : ControllerBase
    {
        private static readonly string CurrentVersion =
            Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.1.0";

        [HttpGet("check")]
        public async Task<IActionResult> Check([FromQuery] string? versionFileUrl = null)
        {
            var url = versionFileUrl
                ?? Path.Combine(AppContext.BaseDirectory, "version.json");

            if (!System.IO.File.Exists(url))
                return Ok(new { hasUpdate = false, currentVersion = CurrentVersion });

            try
            {
                var json = await System.IO.File.ReadAllTextAsync(url);
                var info = JsonSerializer.Deserialize<UpdateInfo>(json,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (info == null) return Ok(new { hasUpdate = false, currentVersion = CurrentVersion });

                bool hasUpdate = Version.TryParse(info.Version, out var remoteVer)
                              && Version.TryParse(CurrentVersion, out var localVer)
                              && remoteVer > localVer;

                return Ok(new
                {
                    hasUpdate,
                    currentVersion = CurrentVersion,
                    latestVersion  = info.Version,
                    releaseNotes   = info.ReleaseNotes,
                    downloadUrl    = info.DownloadUrl,
                });
            }
            catch
            {
                return Ok(new { hasUpdate = false, currentVersion = CurrentVersion });
            }
        }

        [HttpPost("apply")]
        public async Task<IActionResult> Apply([FromBody] ApplyUpdateRequest req)
        {
            if (string.IsNullOrEmpty(req.DownloadUrl) || !System.IO.File.Exists(req.DownloadUrl))
                return BadRequest(new { message = "下载路径无效" });

            var tempExe = Path.GetTempFileName() + ".exe";
            System.IO.File.Copy(req.DownloadUrl, tempExe, overwrite: true);

            // 写替换脚本：等待当前进程退出后替换 exe 并重启
            var currentExe = Environment.ProcessPath ?? string.Empty;
            var bat = $"@echo off\r\ntimeout /t 2 /nobreak >nul\r\ncopy /Y \"{tempExe}\" \"{currentExe}\"\r\nstart \"\" \"{currentExe}\"\r\ndel \"%~f0\"\r\n";
            var batPath = Path.Combine(Path.GetTempPath(), "datum_update.bat");
            await System.IO.File.WriteAllTextAsync(batPath, bat);

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(batPath)
            {
                CreateNoWindow = true, UseShellExecute = true
            });
            Environment.Exit(0);
            return Ok();
        }
    }

    public record UpdateInfo(string Version, string ReleaseNotes, string DownloadUrl);
    public record ApplyUpdateRequest(string DownloadUrl);
}
