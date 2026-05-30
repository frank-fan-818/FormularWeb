import { z } from 'zod';

export function validateOrWarn<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`[Validation] ${label}:`, result.error.flatten());
    return data as T;
  }
  return result.data;
}

export function validateOrDefault<T>(schema: z.ZodSchema<T>, data: unknown, defaultVal: T): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : defaultVal;
}
