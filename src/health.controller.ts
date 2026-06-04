import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class HealthController {
  @ApiOperation({
    summary: 'Liveness probe — used by Render to keep the dyno warm.',
  })
  @Get('healthz')
  healthz() {
    return { status: 'ok', uptime: process.uptime() };
  }
}
