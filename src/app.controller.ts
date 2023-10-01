import { Controller, Get } from '@nestjs/common';
import { SkipRateLimiter } from './common/decorator/skip-throttling.decorator';

@Controller()
export class AppController {
  @Get('/health')
  async healthCheck() {
    return 200;
  }

  @Get('/skip')
  @SkipRateLimiter()
  async skip() {
    return 'Skipped route';
  }
}
