import { Module } from '@nestjs/common';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => {
        const host = config.getOrThrow<string>('REDIS_HOST');
        const port = +config.getOrThrow<number>('REDIS_PORT');
        const password = config.getOrThrow<string>('REDIS_PASSWORD');

        return {
          config: {
            host,
            port,
            password,
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
})
export class CustomRedisModule {}
