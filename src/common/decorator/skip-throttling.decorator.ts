import { SetMetadata } from '@nestjs/common';

export const SKIP_RATE_LIMITER_KEY = 'skipRateLimiter';

export const SkipRateLimiter = () => SetMetadata(SKIP_RATE_LIMITER_KEY, true);
