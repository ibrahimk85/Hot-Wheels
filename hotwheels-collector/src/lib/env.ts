/**
 * Environment variables validation
 */

const requiredEnvVars = [
  'DATABASE_URL',
] as const;

const optionalEnvVars = [
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
] as const;

/**
 * Validate required environment variables
 */
export function validateEnv(): void {
  const missing: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file or environment configuration.'
    );
  }

  // Warn about missing optional but recommended variables
  if (process.env.NODE_ENV === 'production') {
    const missingOptional: string[] = [];
    
    for (const envVar of optionalEnvVars) {
      if (!process.env[envVar]) {
        missingOptional.push(envVar);
      }
    }

    if (missingOptional.length > 0) {
      console.warn(
        `Warning: Missing recommended environment variables in production: ${missingOptional.join(', ')}`
      );
    }
  }
}

/**
 * Get environment variable with validation
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  
  if (!value) {
    throw new Error(`Environment variable ${key} is not set and no default value provided`);
  }
  
  return value;
}

/**
 * Get optional environment variable
 */
export function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}


