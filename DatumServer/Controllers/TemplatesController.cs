using Datum.Server.Services;
using Microsoft.AspNetCore.Mvc;

namespace Datum.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TemplatesController : ControllerBase
    {
        private readonly DatumDataService _data;
        public TemplatesController(DatumDataService data) => _data = data;

        [HttpGet]
        public IActionResult GetAll() => Ok(_data.GetRegistry().Templates);

        [HttpGet("{clusterKey}")]
        public IActionResult GetOne(string clusterKey)
        {
            var tmpl = _data.GetRegistry().Templates
                .FirstOrDefault(t => t.ClusterKey == clusterKey);
            return tmpl != null ? Ok(tmpl) : NotFound();
        }
    }
}
