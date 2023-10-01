import { HttpException } from '@nestjs/common';

export class RateLimiterException extends HttpException {
  constructor(message: string) {
    super(message, 429);
  }
}
