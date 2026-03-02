using Datum.Core.LevelAggregator;
using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LevelsController : ControllerBase
    {
        private readonly DatumDataService _data;
        public LevelsController(DatumDataService data) => _data = data;

        /// <summary>
        /// 获取所有关卡结构数据
        /// </summary>
        [HttpGet("structures")]
        public IActionResult GetStructures()
        {
            return Ok(_data.GetLevelStructures());
        }

        /// <summary>
        /// 获取所有关卡聚合指标
        /// </summary>
        [HttpGet("metrics")]
        public IActionResult GetMetrics([FromQuery] float? lifetime = null)
        {
            var metrics = _data.GetLevelMetrics(lifetime);
            return Ok(metrics);
        }

        /// <summary>
        /// 获取单个关卡的聚合指标
        /// </summary>
        [HttpGet("metrics/{levelId:int}")]
        public IActionResult GetLevelMetrics(int levelId, [FromQuery] float? lifetime = null)
        {
            var all = _data.GetLevelMetrics(lifetime);
            var result = all.FirstOrDefault(m => m.LevelId == levelId);
            return result != null ? Ok(result) : NotFound();
        }
    }
}
