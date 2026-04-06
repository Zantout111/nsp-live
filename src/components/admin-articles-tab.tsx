'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Plus, RefreshCw, SquarePen, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ArticleRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  featuredImageUrl: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
};

export function AdminArticlesTab({ locale }: { locale: string }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<ArticleRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/articles', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      setRows(Array.isArray(json.data) ? (json.data as ArticleRecord[]) : []);
    } catch (e) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'تعذّر تحميل المقالات' : 'Could not load articles',
        variant: 'destructive',
      });
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [locale, toast]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function remove(id: string) {
    if (!confirm(locale === 'ar' ? 'حذف هذا المقال؟' : 'Delete this article?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/articles/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
      await load();
      toast({
        title: locale === 'ar' ? 'تم الحذف' : 'Deleted',
        description: locale === 'ar' ? 'تم حذف المقال' : 'Article deleted',
      });
    } catch (e) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل حذف المقال' : 'Failed to delete article',
        variant: 'destructive',
      });
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{locale === 'ar' ? 'إدارة المقالات' : 'Articles Management'}</span>
            <div className="flex items-center gap-2">
              <Link href="/admin/articles/new">
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4" />
                  <span className="ms-1">{locale === 'ar' ? 'مقال جديد' : 'New article'}</span>
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                <span className="ms-1">{locale === 'ar' ? 'تحديث' : 'Refresh'}</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="bg-card/50">
        <CardContent className="space-y-3 pt-6">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-border/70 bg-muted/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 font-semibold">{r.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">/{r.slug}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.isPublished
                      ? locale === 'ar'
                        ? 'منشور'
                        : 'Published'
                      : locale === 'ar'
                        ? 'مسودة'
                        : 'Draft'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/admin/articles/${r.id}`}>
                    <Button size="icon" variant="ghost" className="h-7 w-7">
                      <SquarePen className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-500"
                    onClick={() => remove(r.id)}
                    disabled={deletingId === r.id}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {locale === 'ar' ? 'لا توجد مقالات بعد.' : 'No articles yet.'}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

