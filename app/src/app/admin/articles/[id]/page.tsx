import { AdminArticleEditor } from '@/components/admin-article-editor';

export const dynamic = 'force-dynamic';

export default async function AdminEditArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminArticleEditor articleId={id} />;
}

