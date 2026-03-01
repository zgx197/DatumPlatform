using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;
using System.Reflection;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        private readonly DatumDataService _data;
        public HealthController(DatumDataService data) => _data = data;

        [HttpGet]
        public IActionResult Get()
        {
            var monsters = _data.GetMonsters();
            var scores   = _data.GetScores();
            return Ok(new
            {
                status       = "ok",
                version      = _data.Version,
                monsterCount = monsters.Count,
                scoreCount   = scores.Count,
                dataDir      = _data.DataDir,
                serverTime   = DateTime.UtcNow,
            });
        }
    }
}
