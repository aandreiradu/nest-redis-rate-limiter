import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './common/utils/env.validation';
import { CustomRedisModule } from './modules/redis/redis.module';
import { CustomRedisService } from './modules/redis/redis.service';
import { AppController } from './app.controller';
import { APP_GUARD } from '@nestjs/core';
import { RateLimiterGuard } from './common/guards/rate-limiter/rate-limiter.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validate }),
    CustomRedisModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
    CustomRedisService,
  ],
})
export class AppModule {}
