import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toNumericCard(cardNumber: string | null): number | null {
  if (!cardNumber) return null;
  const m = cardNumber.match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const variants = await prisma.variant.findMany({
    where: {
      model: {
        collection: {
          name: 'Boulevard',
          year: {
            year: { gte: 2020 },
          },
        },
      },
    },
    select: {
      id: true,
      year: true,
      cardNumber: true,
      model: {
        select: {
          id: true,
          castingName: true,
          collection: {
            select: {
              year: { select: { year: true } },
            },
          },
        },
      },
    },
  });

  const byYear = new Map<number, typeof variants>();
  for (const v of variants) {
    const y = v.model.collection.year.year;
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y)!.push(v);
  }

  const expectedRanges: Record<number, { min: number; max: number; expectedCount: number }> = {
    2020: { min: 1, max: 20, expectedCount: 20 },
    2021: { min: 21, max: 40, expectedCount: 20 },
    2022: { min: 41, max: 65, expectedCount: 25 },
    2023: { min: 66, max: 90, expectedCount: 25 },
    2024: { min: 91, max: 115, expectedCount: 25 },
    2025: { min: 116, max: 140, expectedCount: 25 },
    2026: { min: 141, max: 155, expectedCount: 15 },
  };

  const report = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, list]) => {
      const parsedNumbers = list
        .map((x) => toNumericCard(x.cardNumber))
        .filter((n): n is number => n !== null);
      const unique = new Set(parsedNumbers);
      const missingCard = list.filter((x) => !x.cardNumber || x.cardNumber.trim() === '').length;
      const expected = expectedRanges[year];
      const missingExpected: number[] = [];
      const outOfRange: number[] = [];
      const outOfRangeVariants: Array<{ id: number; cardNumber: string | null; castingName: string }> = [];
      const nonNumericCardVariants: Array<{ id: number; cardNumber: string | null; castingName: string }> = [];
      const duplicateNumericCards: Array<{ cardNumber: number; count: number; variants: Array<{ id: number; castingName: string; rawCardNumber: string | null }> }> = [];
      if (expected) {
        const cardCountMap = new Map<number, number>();
        for (const row of list) {
          const numeric = toNumericCard(row.cardNumber);
          if (numeric === null) {
            nonNumericCardVariants.push({
              id: row.id,
              cardNumber: row.cardNumber,
              castingName: row.model.castingName,
            });
            continue;
          }
          cardCountMap.set(numeric, (cardCountMap.get(numeric) ?? 0) + 1);
          if (numeric < expected.min || numeric > expected.max) {
            outOfRangeVariants.push({
              id: row.id,
              cardNumber: row.cardNumber,
              castingName: row.model.castingName,
            });
          }
        }
        for (let n = expected.min; n <= expected.max; n++) {
          if (!unique.has(n)) missingExpected.push(n);
        }
        for (const n of unique) {
          if (n < expected.min || n > expected.max) outOfRange.push(n);
        }
        for (const [cardNumber, count] of cardCountMap.entries()) {
          if (count > 1) duplicateNumericCards.push({ cardNumber, count });
        }
        for (const dup of duplicateNumericCards) {
          dup.variants = list
            .map((row) => ({
              id: row.id,
              castingName: row.model.castingName,
              rawCardNumber: row.cardNumber,
              numeric: toNumericCard(row.cardNumber),
            }))
            .filter((row) => row.numeric === dup.cardNumber)
            .map(({ id, castingName, rawCardNumber }) => ({ id, castingName, rawCardNumber }));
        }
      }
      return {
        year,
        total: list.length,
        missingCard,
        parsedCount: parsedNumbers.length,
        uniqueCount: unique.size,
        min: parsedNumbers.length ? Math.min(...parsedNumbers) : null,
        max: parsedNumbers.length ? Math.max(...parsedNumbers) : null,
        expectedCount: expected?.expectedCount ?? null,
        missingExpected,
        outOfRange,
        duplicateNumericCards,
        nonNumericCardVariants,
        outOfRangeVariants,
      };
    });

  console.log(JSON.stringify(report, null, 2));

  // Detailed duplicate groups by (year, castingName)
  const dupGroups = new Map<string, Array<{ id: number; cardNumber: string | null }>>();
  for (const v of variants) {
    const year = v.model.collection.year.year;
    const key = `${year} | ${v.model.castingName}`;
    if (!dupGroups.has(key)) dupGroups.set(key, []);
    dupGroups.get(key)!.push({ id: v.id, cardNumber: v.cardNumber });
  }
  const duplicateDetails = [...dupGroups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, variants: list }))
    .sort((a, b) => a.key.localeCompare(b.key));

  if (duplicateDetails.length > 0) {
    console.log('\nDUPLICATE GROUPS BY YEAR+CASTING');
    console.log(JSON.stringify(duplicateDetails, null, 2));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

