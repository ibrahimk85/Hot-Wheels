import prisma from '@/db';

/**
 * Get a setting value by key
 * @param key - The setting key
 * @returns The setting value or null if not found
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.settings.findUnique({
    where: { key },
    select: { value: true },
  });

  return setting?.value ?? null;
}

/**
 * Set or update a setting value
 * @param key - The setting key
 * @param value - The setting value
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.settings.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}








