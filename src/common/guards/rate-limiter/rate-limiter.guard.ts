import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { CustomRedisService } from 'src/modules/redis/redis.service';
import { SKIP_RATE_LIMITER_KEY } from 'src/common/decorator/skip-throttling.decorator';
import { RateLimiterException } from 'src/common/utils/rate-limiter.exception';

interface RequestIpLog {
  requestCount: number;
  ipAddressBlocked: boolean;
  lastRequestTimestamp: number;
  firstRequestTimestamp?: number;
  blockedUntilTimestamp: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private MAX_REQUEST_COUNT;
  private REQUEST_BLOCK_DURATION_IN_MINUTES;
  private WINDOW_SIZE_IN_MINUTES;

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

    this.WINDOW_SIZE_IN_MINUTES = +this.configService.getOrThrow<number>(
      'WINDOW_SIZE_IN_MINUTES',
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const shouldSkipRateLimiter = this.reflector.getAllAndOverride(
      SKIP_RATE_LIMITER_KEY,
      [context.getHandler(), context.getClass()],
    );

    console.log('shouldSkipRateLimiter', shouldSkipRateLimiter);

    if (shouldSkipRateLimiter) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const requestIP = req.ip;
    const requestTimestamp = Date.now();
    const existingRequestLog = await this.redisService.get<RequestIpLog>(
      requestIP,
    );

    console.log('existingRequestLog', existingRequestLog);

    const requestIpLog: RequestIpLog = {
      ipAddressBlocked: false,
      requestCount: 1,
      lastRequestTimestamp: requestTimestamp,
      firstRequestTimestamp: requestTimestamp,
      blockedUntilTimestamp: 0,
    };
    if (!existingRequestLog) {
      console.log(`${requestIP} not found, save to redis`);

      await this.redisService.set(requestIP, requestIpLog);
      console.log(`${requestIP} saved in REDIS`);
      return true;
    }

    const {
      ipAddressBlocked,
      requestCount,
      blockedUntilTimestamp,
      firstRequestTimestamp,
    } = existingRequestLog;

    /* Check if the IP is blocked from previously requests */
    if (ipAddressBlocked) {
      console.log(`IP: ${requestIP} is blocked. Start performing checks...`);
      /* Check if block duration has passed. */

      /* The block duration has not passed, block the request */
      if (blockedUntilTimestamp > requestTimestamp) {
        console.log(
          `The block duration (${new Date(
            blockedUntilTimestamp,
          )}) has not passed, block the request`,
        );
        throw new RateLimiterException(`Limit exceeded for IP ${requestIP}`);
      } else {
        /* The block duration passed, reset the request */
        console.log('The block duration passed, reset the request');
        await this.redisService.set(requestIP, requestIpLog);
        return true;
      }
    } else {
      console.log('this.WINDOW_SIZE_IN_MINUTES', this.WINDOW_SIZE_IN_MINUTES);
      const windowStartTimestamp =
        requestTimestamp - +(this.WINDOW_SIZE_IN_MINUTES * 60000); // ms

      console.log('windowStartTimestamp', windowStartTimestamp);

      if (firstRequestTimestamp < windowStartTimestamp) {
        await this.redisService.set(requestIP, requestIpLog);
        return true;
      } else if (
        firstRequestTimestamp >= windowStartTimestamp &&
        requestCount >= this.MAX_REQUEST_COUNT
      ) {
        const blockedRequestLog: RequestIpLog = {
          ...requestIpLog,
          ipAddressBlocked: true,
          blockedUntilTimestamp:
            requestTimestamp + this.REQUEST_BLOCK_DURATION_IN_MINUTES * 60000,
          requestCount: this.MAX_REQUEST_COUNT,
        };

        console.log('blockedRequestLog', blockedRequestLog);

        await this.redisService.set(requestIP, blockedRequestLog);

        throw new RateLimiterException(
          `Maximum attempts exceeded. Please try later.`,
        );
      } else if (
        firstRequestTimestamp >= windowStartTimestamp &&
        requestCount <= this.MAX_REQUEST_COUNT
      ) {
        console.log('verific reqCOunt', {
          requestCount,
          MAX_REQUEST_COUNT: this.MAX_REQUEST_COUNT,
        });
        const updateRequestLog: RequestIpLog = {
          firstRequestTimestamp: firstRequestTimestamp,
          ipAddressBlocked: false,
          blockedUntilTimestamp: 0,
          lastRequestTimestamp: requestTimestamp,
          requestCount: ++requestIpLog.requestCount,
        };

        console.log('updateRequestLog', updateRequestLog);

        await this.redisService.set(
          requestIP,
          JSON.stringify(updateRequestLog),
        );
        return true;
      }
    }
  }
}
