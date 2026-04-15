import type { Prisma, PrismaClient } from '@prisma/client';

const GOLD_KARAT_FIELDS = ['pricePerGram21', 'pricePerGram18', 'pricePerGram14'] as const;
type GoldKaratField = (typeof GOLD_KARAT_FIELDS)[number];

const PREV_FOR_KARAT: Record<GoldKaratField, 'prevPricePerGram21' | 'prevPricePerGram18' | 'prevPricePerGram14'> = {
  pricePerGram21: 'prevPricePerGram21',
  pricePerGram18: 'prevPricePerGram18',
  pricePerGram14: 'prevPricePerGram14',
};

export type GoldSnapshotUpdate = {
  priceUsd: number;
  pricePerGram: number;
} & Partial<Record<GoldKaratField, number>>;

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
export async function updateLatestGoldWithSnapshot(db: PrismaClient, data: GoldSnapshotUpdate): Promise<void> {
  const latest = await db.goldPrice.findFirst({ orderBy: { updatedAt: 'desc' } });
  const now = new Date();

  const karatCreate: Partial<Record<GoldKaratField, number>> = {};
  for (const k of GOLD_KARAT_FIELDS) {
    const v = data[k];
    if (v !== undefined && Number.isFinite(v) && v > 0) {
      karatCreate[k] = v;
    }
  }

  if (!latest) {
    await db.goldPrice.create({
      data: {
        priceUsd: data.priceUsd,
        pricePerGram: data.pricePerGram,
        lastUpdated: now,
        ...karatCreate,
      },
    });
    return;
  }

  const updateData: Record<string, unknown> = {
    prevPriceUsd: latest.priceUsd,
    prevPricePerGram: latest.pricePerGram,
    prevCapturedAt: latest.lastUpdated,
    priceUsd: data.priceUsd,
    pricePerGram: data.pricePerGram,
    lastUpdated: now,
  };

  for (const k of GOLD_KARAT_FIELDS) {
    const v = data[k];
    if (v === undefined || !Number.isFinite(v) || v <= 0) continue;
    updateData[PREV_FOR_KARAT[k]] = latest[k] ?? null;
    updateData[k] = v;
  }

  await db.goldPrice.update({
    where: { id: latest.id },
    data: updateData as Prisma.GoldPriceUpdateInput,
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
