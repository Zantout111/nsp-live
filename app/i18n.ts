import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  // Provide a static locale, read from cookie, or detect from request headers
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'ar';
  
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default
  };
});
