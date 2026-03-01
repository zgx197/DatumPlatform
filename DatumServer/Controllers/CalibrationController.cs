using Datum.Core.Calibrator;
using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CalibrationController : ControllerBase
    {
        private readonly DatumDataService _data;
        public CalibrationController(DatumDataService data) => _data = data;

        [HttpGet("samples")]
        public IActionResult GetSamples() => Ok(_data.GetCalibrationSamples());

        [HttpPost("run")]
        public IActionResult Run([FromBody] List<CalibrationSample>? samples)
        {
            var list = samples ?? new List<CalibrationSample>(_data.GetCalibrationSamples());
            var result = WeightCalibrator.CalibrateWithScale(list);
            return result != null ? Ok(result) : BadRequest(new { message = "校准失败，样本不足或矩阵奇异" });
        }
    }
}
