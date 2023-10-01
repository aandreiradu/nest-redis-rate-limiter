import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, NextFunction } from 'express';
import { CustomRedisService } from 'src/modules/redis/redis.service';
import { RateLimiterException } from '../utils/rate-limiter.exception';
import { SKIP_RATE_LIMITER_KEY } from '../decorator/skip-throttling.decorator';
import { Reflector } from '@nestjs/core';

interface RequestIpLog {
  requestCount: number;
  ipAddressBlocked: boolean;
  lastRequestTimestamp: number;
  blockedUntilTimestamp: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private MAX_REQUEST_COUNT;
  private REQUEST_BLOCK_DURATION_IN_MINUTES;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly redisService: CustomRedisService,
  ) {
    this.MAX_REQUEST_COUNT =
      +this.configService.getOrThrow<number>('MAX_REQUEST_COUNT');

    this.REQUEST_BLOCK_DURATION_IN_MINUTES =
      +this.configService.getOrThrow<number>(
        'REQUEST_BLOCK_DURATION_IN_MINUTES',
      );
  }

  async use(req: Request, _, next: NextFunction) {
    console.log('metadate', Reflect.getMetadata(SKIP_RATE_LIMITER_KEY, req));
    const path = req.route?.path;

    const shouldSkipRateLimiter =
      this.reflector.get<string[]>(
        SKIP_RATE_LIMITER_KEY,
        undefined, // Pass undefined instead of an empty array
      ) || [];

    console.log('shouldSkipRateLimiter', shouldSkipRateLimiter);
    if (shouldSkipRateLimiter.includes(path)) {
      console.log('include');
      next();
    }

    const requestIP = req.ip;
    const requestTimestamp = Date.now();
    const existingRequestLog = await this.redisService.get<RequestIpLog>(
      requestIP,
    );

    const requestIpLog: RequestIpLog = {
      ipAddressBlocked: false,
      requestCount: 1,
      lastRequestTimestamp: requestTimestamp,
      blockedUntilTimestamp: 0,
    };
    if (!existingRequestLog) {
      console.log(`${requestIP} not found, save to redis`);

      await this.redisService.set(requestIP, requestIpLog);
      console.log(`${requestIP} saved in REDIS`);
      next();
    }

    const { ipAddressBlocked, requestCount, blockedUntilTimestamp } =
      existingRequestLog;

    /* Check if the IP is blocked from previously requests */
    if (ipAddressBlocked) {
      console.log(`IP: ${requestIP} is blocked. Start performing checks...`);
      /* Check if block duration has passed. */

      /* The block duration has not passed, block the request */
      if (blockedUntilTimestamp > requestTimestamp) {
        console.log('The block duration has not passed, block the request');
        throw new RateLimiterException(`Limit exceeded for IP ${requestIP}`);
      } else {
        /* The block duration passed, reset the request */
        console.log('The block duration passed, reset the request');
        await this.redisService.set(requestIP, requestIpLog);
        next();
      }
    } else {
      /* check if the limit has exceeded */
      if (+requestCount + 1 > this.MAX_REQUEST_COUNT) {
        console.log(`IP: ${requestIP} exceeded the requests, block it`);

        const blockRequestIp = {
          ...requestIpLog,
          ipAddressBlocked: true,
          requestCount: this.MAX_REQUEST_COUNT,
          lastRequestTimestamp: requestTimestamp,
          blockedUntilTimestamp:
            requestTimestamp + this.REQUEST_BLOCK_DURATION_IN_MINUTES * 60000,
        };

        console.log('blockRequestIp', blockRequestIp);
        await this.redisService.set(requestIP, blockRequestIp);
      }
    }
  }
}
