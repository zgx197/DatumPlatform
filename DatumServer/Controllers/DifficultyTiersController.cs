using Microsoft.AspNetCore.Mvc;
using Datum.Server.Services;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/difficulty-tiers")]
    public class DifficultyTiersController : ControllerBase
    {
        private readonly DatumDataService _data;
        public DifficultyTiersController(DatumDataService data) => _data = data;

        /// <summary>
        /// 返回当前评分数据的难度档位摘要（阈值 + 每只怪物的 tier 标签）。
        /// 供关卡编辑器等外部工具消费，无需理解原始评分数值。
        /// </summary>
        [HttpGet]
        public IActionResult Get() => Ok(_data.GetDifficultyTiers());
    }
}
