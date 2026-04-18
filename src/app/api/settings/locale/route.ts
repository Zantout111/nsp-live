import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const validLocales = ['ar', 'en', 'de', 'sv', 'fr'];

export async function GET() {
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get('locale')?.value || 'ar';
    return NextResponse.json({ locale });
  } catch (error) {
    console.error('Error getting locale:', error);
    return NextResponse.json({ locale: 'ar' });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locale } = body;

    if (!locale || !validLocales.includes(locale)) {
      return NextResponse.json(
        { success: false, error: 'Invalid locale' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set('locale', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
    });

    return NextResponse.json({ success: true, locale });
  } catch (error) {
    console.error('Error setting locale:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set locale' },
      { status: 500 }
    );
  }
}
