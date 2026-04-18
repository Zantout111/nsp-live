import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// DELETE - حذف عملة
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    await db.exchangeRate.deleteMany({
      where: { currencyId: id },
    });
    
    await db.currency.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting currency:', error);
    return NextResponse.json({ error: 'خطأ في حذف العملة' }, { status: 500 });
  }
}

// PUT - تحديث بيانات العملة
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { nameAr, nameEn, symbol, flagEmoji, sortOrder, isActive } = body;

    const currency = await db.currency.update({
      where: { id },
      data: {
        nameAr,
        nameEn,
        symbol,
        flagEmoji,
        sortOrder,
        isActive,
      },
    });

    return NextResponse.json(currency);
  } catch (error) {
    console.error('Error updating currency:', error);
    return NextResponse.json({ error: 'خطأ في تحديث العملة' }, { status: 500 });
  }
}
