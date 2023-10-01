import z, { ZodSchema } from 'zod';

const envValidationSchema = z.object({
  REDIS_HOST: z.string().nonempty(),
  REDIS_PASSWORD: z.string().nonempty(),
  REDIS_PORT: z.coerce.number(),
  MAX_REQUEST_COUNT: z.coerce.number(),
  REQUEST_BLOCK_DURATION_IN_MINUTES: z.coerce.number(),
  WINDOW_SIZE_IN_MINUTES: z.coerce.number(),
});

export const validate = <T extends ZodSchema>(config: Record<string, T>) => {
  const schemaValidation = envValidationSchema.safeParse(config);

  if (schemaValidation.success === false) {
    throw new Error(schemaValidation.error.message);
  }

  return config;
};
