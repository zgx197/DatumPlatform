using Microsoft.AspNetCore.SignalR;

namespace Datum.Server.Hubs
{
    /// <summary>
    /// SignalR Hub：向前端推送数据更新事件。
    /// 前端监听 "DataUpdated" 事件后自动刷新。
    /// </summary>
    public class DatumHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
        }
    }
}
