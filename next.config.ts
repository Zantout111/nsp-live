import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** عناوين إضافية من البيئة (مفصولة بفاصلة)، مثال: NEXT_DEV_ALLOWED_ORIGINS=10.5.4.3,myhost.local */
const extraAllowedDevOrigins =
  process.env.NEXT_DEV_ALLOWED_ORIGINS?.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean) ?? [];

/**
 * في التطوير، Next يحجب طلبات /_next/* إذا كان Origin (مضيف الصفحة) ليس في القائمة.
 * الوصول عبر IP الشبكة (مثل http://10.x.x.x:3000) يُرسل Origin بتلك العناوين فيُرفض التحميل
 * فيبقى الموقع على شاشة تحميل/بدون معاينة. الأنماط أدناه تغطي شبكات RFC1918 شائعة.
 */
const lanDevOriginPatterns = [
  '10.*.*.*',
  '192.168.*.*',
  '172.16.*.*',
  '172.17.*.*',
  '172.18.*.*',
  '172.19.*.*',
  '172.20.*.*',
  '172.21.*.*',
  '172.22.*.*',
  '172.23.*.*',
  '172.24.*.*',
  '172.25.*.*',
  '172.26.*.*',
  '172.27.*.*',
  '172.28.*.*',
  '172.29.*.*',
  '172.30.*.*',
  '172.31.*.*',
  '100.*.*.*', // Tailscale / بعض شبكات CGNAT
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Use webpack instead of turbopack to avoid cache corruption issues
  // Copy database and messages to standalone build
  outputFileTracingIncludes: {
    // Next 16 + npm overrides: يجب تضمين الحزمة كاملة وإلا standalone يفشل عند التشغيل (MODULE_NOT_FOUND @swc/helpers)
    '/*': ['./db/**/*', './messages/**/*', './node_modules/@swc/helpers/**/*'],
  },
  allowedDevOrigins: [
    'preview-chat-58e713bf-deb4-46e9-83be-0f2e91c630df.space.z.ai',
    '.space.z.ai',
    'localhost',
    '127.0.0.1',
    '::1',
    ...lanDevOriginPatterns,
    ...extraAllowedDevOrigins,
  ],
};

export default withNextIntl(nextConfig);
