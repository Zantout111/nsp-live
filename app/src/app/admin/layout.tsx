import type { ReactNode } from "react";

/** يعزل لوحة التحكم بثيم ألوان أقرب للواجهة الإدارية الأصلية (ذهبي/داكن) دون تأثير ستايل الصفحة العامة */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="admin-panel min-h-screen">{children}</div>;
}
