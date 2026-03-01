using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MonstersController : ControllerBase
    {
        private readonly DatumDataService _data;
        public MonstersController(DatumDataService data) => _data = data;

        [HttpGet]
        public IActionResult GetAll() => Ok(_data.GetMonsters());

        [HttpGet("{configId:int}")]
        public IActionResult GetOne(int configId)
        {
            var row = _data.GetMonsters().FirstOrDefault(m => m.ConfigId == configId);
            return row != null ? Ok(row) : NotFound();
        }
    }
}
