import { Controller, Get } from '@nestjs/common';

/**
 * Liveness probe for Docker / load balancers.
 * Domain health (DB, AI) will be expanded later if needed.
 */
@Controller()
export class AppController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
