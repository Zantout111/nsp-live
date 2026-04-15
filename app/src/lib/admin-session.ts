import { cookies } from 'next/headers';

const SESSION_COOKIE = 'admin_session';
const SESSION_SECRET = 'syp-rates-secret-key-2024';

function verifySessionToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.startsWith(SESSION_SECRET);
  } catch {
    return false;
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return !!(token && verifySessionToken(token));
}
