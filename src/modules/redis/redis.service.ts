import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CustomRedisService {
  private readonly redis: Redis;

  constructor(private readonly redisService: RedisService) {
    this.redis = this.redisService.getClient();
  }

  async set(key: string, value: any) {
    return this.redis.set(key, JSON.stringify(value));
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);

      if (!value) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      console.log(`Unable to get from Redis`, error);

      throw new InternalServerErrorException();
    }
  }

  async delete(key): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.group(`Unbable to delete from redis`, error);

      throw new InternalServerErrorException();
    }
  }
}
