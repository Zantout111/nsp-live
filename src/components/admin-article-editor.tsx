'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, RefreshCw, Save, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArticleRichEditor } from '@/components/article-rich-editor';

type ArticleRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  featuredImageUrl: string | null;
  featuredImageAlt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  focusKeyword: string | null;
  isPublished: boolean;
};

type ArticleForm = {
  title: string;
  slug: string;
  description: string;
  content: string;
  featuredImageUrl: string;
  featuredImageAlt: string;
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  isPublished: boolean;
};

function emptyForm(): ArticleForm {
  return {
    title: '',
    slug: '',
    description: '',
    content: '',
    featuredImageUrl: '',
    featuredImageAlt: '',
    metaTitle: '',
    metaDescription: '',
    focusKeyword: '',
    isPublished: false,
  };
}

function toForm(row: ArticleRecord): ArticleForm {
  return {
    title: row.title || '',
    slug: row.slug || '',
    description: row.description || '',
    content: row.content || '',
    featuredImageUrl: row.featuredImageUrl || '',
    featuredImageAlt: row.featuredImageAlt || '',
    metaTitle: row.metaTitle || '',
    metaDescription: row.metaDescription || '',
    focusKeyword: row.focusKeyword || '',
    isPublished: Boolean(row.isPublished),
  };
}

function normalizeWordCount(content: string): number {
  return content
    .replace(/[#>*`_\-\[\]\(\)!]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

function countKeyword(content: string, kw: string): number {
  if (!kw.trim()) return 0;
  const source = content.toLowerCase();
  const target = kw.trim().toLowerCase();
  let c = 0;
  let p = 0;
  while (true) {
    const idx = source.indexOf(target, p);
    if (idx < 0) break;
    c++;
    p = idx + target.length;
  }
  return c;
}

function seoChecks(form: ArticleForm) {
  const title = form.title.trim();
  const slug = form.slug.trim().toLowerCase();
  const desc = form.description.trim();
  const content = form.content;
  const keyword = form.focusKeyword.trim().toLowerCase();
  const metaTitle = form.metaTitle.trim();
  const metaDescription = form.metaDescription.trim();
  const wc = normalizeWordCount(content);
  const keywordCount = keyword ? countKeyword(`${title}\n${desc}\n${content}`, keyword) : 0;
  const hasAnyHeading = /^#{1,4}\s+/m.test(content);
  const hasImageWithAlt = /!\[[^\]]+\]\([^)]+\)/.test(content);

  const checks = [
    { ok: !!keyword, label: 'تم تحديد كلمة مفتاحية' },
    { ok: !!title && !!keyword && title.toLowerCase().includes(keyword), label: 'الكلمة المفتاحية داخل عنوان المقال' },
    { ok: !!slug && !!keyword && slug.includes(keyword.replace(/\s+/g, '-')), label: 'الكلمة المفتاحية داخل الرابط (slug)' },
    { ok: !!desc && !!keyword && desc.toLowerCase().includes(keyword), label: 'الكلمة المفتاحية داخل الوصف' },
    { ok: wc >= 300, label: 'طول المحتوى مناسب (300 كلمة على الأقل)' },
    { ok: keywordCount >= 2, label: 'تكرار الكلمة المفتاحية كافٍ داخل المحتوى' },
    { ok: hasAnyHeading, label: 'استخدام عناوين H1-H4 داخل المقال' },
    { ok: !!metaTitle && metaTitle.length >= 30 && metaTitle.length <= 60, label: 'Meta title بين 30 و60 حرفاً' },
    {
      ok: !!metaDescription && metaDescription.length >= 110 && metaDescription.length <= 170,
      label: 'Meta description بين 110 و170 حرفاً',
    },
    {
      ok: !!form.featuredImageUrl && (!!form.featuredImageAlt || hasImageWithAlt),
      label: 'صورة بارزة مع alt (أو صور داخل المحتوى مع alt)',
    },
  ];

  const okCount = checks.filter((c) => c.ok).length;
  const score = Math.round((okCount / checks.length) * 100);
  return { score, checks, wc, keywordCount };
}

function slugifyLocal(v: string): string {
  return String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[\u0622\u0623\u0625]/g, 'ا')
    .replace(/[^a-z0-9\u0600-\u06FF\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function AdminArticleEditor({ articleId }: { articleId?: string }) {
  const { toast } = useToast();
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(Boolean(articleId));
  const [saving, setSaving] = useState(false);
  const [uploadingFeatured, setUploadingFeatured] = useState(false);
  const [form, setForm] = useState<ArticleForm>(emptyForm());
  const featuredFileRef = useRef<HTMLInputElement | null>(null);

  const seo = useMemo(() => seoChecks(form), [form]);

  useEffect(() => {
    (async () => {
      const authRes = await fetch('/api/auth', { credentials: 'include' });
      const authJson = await authRes.json().catch(() => ({}));
      if (!authJson?.authenticated) {
        router.replace('/admin');
        return;
      }
      if (!articleId) return;
      try {
        const res = await fetch(`/api/admin/articles/${articleId}`, { credentials: 'include' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Failed');
        setForm(toForm(json.data as ArticleRecord));
      } catch (e) {
        toast({
          title: locale === 'ar' ? 'خطأ' : 'Error',
          description: locale === 'ar' ? 'تعذّر تحميل المقال' : 'Could not load article',
          variant: 'destructive',
        });
        console.error(e);
      } finally {
        setLoading(false);
      }
    })().catch(console.error);
  }, [articleId, locale, router, toast]);

  async function save() {
    if (!form.title.trim()) {
      toast({
        title: locale === 'ar' ? 'تنبيه' : 'Warning',
        description: locale === 'ar' ? 'عنوان المقال مطلوب' : 'Article title is required',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        slug: (form.slug || slugifyLocal(form.title)).trim(),
      };
      const endpoint = articleId ? `/api/admin/articles/${articleId}` : '/api/admin/articles';
      const method = articleId ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed');

      const id = (json.data as ArticleRecord).id;
      toast({
        title: locale === 'ar' ? 'تم الحفظ' : 'Saved',
        description: locale === 'ar' ? 'تم حفظ المقال بنجاح' : 'Article saved successfully',
      });
      router.replace(`/admin/articles/${id}`);
      router.refresh();
    } catch (e) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل حفظ المقال' : 'Failed to save article',
        variant: 'destructive',
      });
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/admin/upload-article-image', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; url?: string; error?: string };
    if (!res.ok || !json.success || !json.url) {
      throw new Error(json.error || 'Upload failed');
    }
    return json.url;
  }

  async function onFeaturedFilePicked(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFeatured(true);
    try {
      const url = await uploadImage(file);
      setForm((p) => ({ ...p, featuredImageUrl: url }));
      toast({
        title: locale === 'ar' ? 'تم الرفع' : 'Uploaded',
        description: locale === 'ar' ? 'تم رفع الصورة البارزة' : 'Featured image uploaded',
      });
    } catch (err) {
      toast({
        title: locale === 'ar' ? 'خطأ' : 'Error',
        description: locale === 'ar' ? 'فشل رفع الصورة' : 'Image upload failed',
        variant: 'destructive',
      });
      console.error(err);
    } finally {
      setUploadingFeatured(false);
    }
  }

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-6">
        <div className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
          {locale === 'ar' ? 'جارٍ تحميل المحرر...' : 'Loading editor...'}
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Link
                  href="/admin"
                  className="inline-flex items-center rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ms-1">{locale === 'ar' ? 'رجوع' : 'Back'}</span>
                </Link>
                <span>
                  {articleId
                    ? locale === 'ar'
                      ? 'تحرير المقال'
                      : 'Edit article'
                    : locale === 'ar'
                      ? 'مقال جديد'
                      : 'New article'}
                </span>
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ms-1">{locale === 'ar' ? 'حفظ المقال' : 'Save article'}</span>
              </Button>
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="bg-card/50">
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{locale === 'ar' ? 'عنوان المقال' : 'Article title'}</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{locale === 'ar' ? 'الرابط (slug)' : 'Slug'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.slug}
                    onChange={(e) => setForm((p) => ({ ...p, slug: slugifyLocal(e.target.value) }))}
                    placeholder="my-article-slug"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm((p) => ({ ...p, slug: slugifyLocal(p.slug || p.title) }))}
                  >
                    {locale === 'ar' ? 'توليد' : 'Generate'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{locale === 'ar' ? 'الوصف المختصر' : 'Short description'}</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{locale === 'ar' ? 'الصورة البارزة' : 'Featured image URL'}</Label>
                <div className="flex gap-2">
                  <Input
                    value={form.featuredImageUrl}
                    onChange={(e) => setForm((p) => ({ ...p, featuredImageUrl: e.target.value }))}
                    placeholder="https://... /uploads/..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => featuredFileRef.current?.click()}
                    disabled={uploadingFeatured}
                  >
                    {uploadingFeatured ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span className="ms-1">{locale === 'ar' ? 'رفع' : 'Upload'}</span>
                  </Button>
                </div>
                <input
                  ref={featuredFileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                  className="hidden"
                  onChange={onFeaturedFilePicked}
                />
              </div>
              <div className="space-y-2">
                <Label>{locale === 'ar' ? 'alt للصورة البارزة' : 'Featured image alt'}</Label>
                <Input value={form.featuredImageAlt} onChange={(e) => setForm((p) => ({ ...p, featuredImageAlt: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{locale === 'ar' ? 'محرر المحتوى المرئي' : 'Visual content editor'}</Label>
              <p className="text-xs text-muted-foreground">
                {locale === 'ar'
                  ? 'اختر نوع الفقرة من القائمة: H1/H2/H3/H4. لإلغاء العنوان وإرجاع النص عادي اختر Paragraph (P).'
                  : 'Use block type picker for H1/H2/H3/H4. To remove heading and return to normal text choose Paragraph (P).'}
              </p>
              <ArticleRichEditor
                markdown={form.content}
                onChange={(value) => setForm((p) => ({ ...p, content: value }))}
                onUploadImage={uploadImage}
              />
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input value={form.metaTitle} onChange={(e) => setForm((p) => ({ ...p, metaTitle: e.target.value }))} />
                <p className="text-xs text-muted-foreground">{form.metaTitle.length} chars</p>
              </div>
              <div className="space-y-2">
                <Label>{locale === 'ar' ? 'الكلمة المفتاحية' : 'Focus keyword'}</Label>
                <Input
                  value={form.focusKeyword}
                  onChange={(e) => setForm((p) => ({ ...p, focusKeyword: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Meta Description</Label>
              <Textarea rows={3} value={form.metaDescription} onChange={(e) => setForm((p) => ({ ...p, metaDescription: e.target.value }))} />
              <p className="text-xs text-muted-foreground">{form.metaDescription.length} chars</p>
            </div>

            <div className="rounded-lg border border-border/70 bg-muted/40 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{locale === 'ar' ? 'فحص SEO (نمط RankMath مبسط)' : 'SEO checks (RankMath-like)'}</h3>
                <span
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-bold',
                    seo.score >= 80 ? 'bg-emerald-500/20 text-emerald-600' : seo.score >= 60 ? 'bg-amber-500/20 text-amber-600' : 'bg-red-500/20 text-red-600'
                  )}
                >
                  {seo.score}%
                </span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">
                {locale === 'ar' ? 'عدد الكلمات' : 'Word count'}: {seo.wc} — {locale === 'ar' ? 'تكرار الكلمة المفتاحية' : 'Keyword count'}: {seo.keywordCount}
              </p>
              <ul className="space-y-1 text-xs">
                {seo.checks.map((c, i) => (
                  <li key={i} className={cn('flex items-center gap-2', c.ok ? 'text-emerald-600' : 'text-red-500')}>
                    {c.ok ? <Check className="h-3.5 w-3.5" /> : <span className="h-3.5 w-3.5">•</span>}
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={form.isPublished} onCheckedChange={(v) => setForm((p) => ({ ...p, isPublished: v }))} />
                <span className="text-sm">{locale === 'ar' ? 'نشر المقال' : 'Publish article'}</span>
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ms-1">{locale === 'ar' ? 'حفظ المقال' : 'Save article'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

