using Datum.Core.Aggregator;
using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WeightsController : ControllerBase
    {
        private readonly DatumDataService _data;
        public WeightsController(DatumDataService data) => _data = data;

        [HttpGet]
        public IActionResult Get() => Ok(_data.GetWeightConfig());

        [HttpPut]
        public IActionResult Update([FromBody] EvaluationWeightConfig weights)
        {
            _data.UpdateWeightConfig(weights);
            return Ok(new { message = "权重已更新并重新计算评分" });
        }
    }
}
