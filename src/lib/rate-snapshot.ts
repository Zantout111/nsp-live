import type { PrismaClient } from '@prisma/client';

export async function upsertExchangeRateWithSnapshot(
  db: PrismaClient,
  params: { currencyId: string; buyRate: number; sellRate: number }
): Promise<void> {
  const existing = await db.exchangeRate.findUnique({ where: { currencyId: params.currencyId } });
  const now = new Date();
  if (!existing) {
    await db.exchangeRate.create({
      data: {
        currencyId: params.currencyId,
        buyRate: params.buyRate,
        sellRate: params.sellRate,
        lastUpdated: now,
      },
    });
    return;
  }
  await db.exchangeRate.update({
    where: { currencyId: params.currencyId },
    data: {
      prevBuyRate: existing.buyRate,
      prevSellRate: existing.sellRate,
      prevCapturedAt: existing.lastUpdated,
      buyRate: params.buyRate,
      sellRate: params.sellRate,
      lastUpdated: now,
    },
  });
}

/** يحدّث أحدث سجل ذهب (كما تعرضه واجهة المستخدم) مع حفظ اللقطة السابقة. */
export async function updateLatestGoldWithSnapshot(
  db: PrismaClient,
  data: { priceUsd: number; pricePerGram: number }
): Promise<void> {
  const latest = await db.goldPrice.findFirst({ orderBy: { updatedAt: 'desc' } });
  const now = new Date();
  if (!latest) {
    await db.goldPrice.create({
      data: { priceUsd: data.priceUsd, pricePerGram: data.pricePerGram, lastUpdated: now },
    });
    return;
  }
  await db.goldPrice.update({
    where: { id: latest.id },
    data: {
      prevPriceUsd: latest.priceUsd,
      prevPricePerGram: latest.pricePerGram,
      prevCapturedAt: latest.lastUpdated,
      priceUsd: data.priceUsd,
      pricePerGram: data.pricePerGram,
      lastUpdated: now,
    },
  });
}

export async function updateFuelPriceWithSnapshot(
  db: PrismaClient,
  code: string,
  price: number
): Promise<void> {
  const row = await db.fuelPrice.findUnique({ where: { code } });
  if (!row) return;
  const now = new Date();
  await db.fuelPrice.update({
    where: { code },
    data: {
      prevPrice: row.price,
      prevCapturedAt: row.lastUpdated,
      price,
      lastUpdated: now,
    },
  });
}
