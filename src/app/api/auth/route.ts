import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// بيانات تسجيل الدخول
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'SYP@Rates2024!';
const SESSION_COOKIE = 'admin_session';
const SESSION_SECRET = 'syp-rates-secret-key-2024';

// إنشاء رمز جلسة بسيط
function createSessionToken(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return Buffer.from(`${SESSION_SECRET}:${timestamp}:${random}`).toString('base64');
}

// التحقق من الجلسة
function verifySession(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.startsWith(SESSION_SECRET);
  } catch {
    return false;
  }
}

// POST - تسجيل الدخول
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const sessionToken = createSessionToken();
      const cookieStore = await cookies();
      
      cookieStore.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 24 ساعة
        path: '/',
      });

      return NextResponse.json({
        success: true,
        message: 'تم تسجيل الدخول بنجاح'
      });
    }

    return NextResponse.json({
      success: false,
      message: 'اسم المستخدم أو كلمة المرور غير صحيحة'
    }, { status: 401 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({
      success: false,
      message: 'حدث خطأ في تسجيل الدخول'
    }, { status: 500 });
  }
}

// GET - التحقق من الجلسة
export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE)?.value;

    if (sessionToken && verifySession(sessionToken)) {
      return NextResponse.json({
        success: true,
        authenticated: true
      });
    }

    return NextResponse.json({
      success: false,
      authenticated: false
    });
  } catch {
    return NextResponse.json({
      success: false,
      authenticated: false
    });
  }
}

// DELETE - تسجيل الخروج
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل الخروج'
    });
  } catch {
    return NextResponse.json({
      success: false
    });
  }
}
