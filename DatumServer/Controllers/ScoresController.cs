using Datum.Core.Aggregator;
using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ScoresController : ControllerBase
    {
        private readonly DatumDataService _data;
        public ScoresController(DatumDataService data) => _data = data;

        [HttpGet]
        public IActionResult GetAll(
            [FromQuery] int? foeType = null,
            [FromQuery] int? barriesId = null,
            [FromQuery] string? sort = null,
            [FromQuery] bool desc = true)
        {
            var scores = _data.GetScores().AsEnumerable();

            if (foeType.HasValue)    scores = scores.Where(s => s.FoeType == foeType.Value);
            if (barriesId.HasValue)  scores = scores.Where(s => s.BarriesId == barriesId.Value);

            scores = sort switch
            {
                "ehp"     => desc ? scores.OrderByDescending(s => s.EHPScore)     : scores.OrderBy(s => s.EHPScore),
                "dps"     => desc ? scores.OrderByDescending(s => s.DPSScore)     : scores.OrderBy(s => s.DPSScore),
                "control" => desc ? scores.OrderByDescending(s => s.ControlScore) : scores.OrderBy(s => s.ControlScore),
                _         => desc ? scores.OrderByDescending(s => s.OverallScore) : scores.OrderBy(s => s.OverallScore),
            };

            return Ok(scores.ToList());
        }

        [HttpGet("{configId:int}")]
        public IActionResult GetOne(int configId)
        {
            var score = _data.GetScores().FirstOrDefault(s => s.ConfigId == configId);
            return score != null ? Ok(score) : NotFound();
        }

        [HttpPost("recalc")]
        public IActionResult Recalculate([FromBody] EvaluationWeightConfig weights)
        {
            var scores = _data.RecalculateWithWeights(weights);
            return Ok(scores);
        }
    }
}
