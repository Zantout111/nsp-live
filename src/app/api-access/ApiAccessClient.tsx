'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import QRCodeSVG from 'react-qr-code';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildRateApiDocSnippets } from '@/lib/api-rate-doc-snippets';

type Props = {
  baseUrl: string;
  usdtAddress: string | null;
  subscriptionPriceUsd: number;
  subscriptionDays: number;
};

function formatUsdPrice(n: number): string {
  if (!Number.isFinite(n)) return '50';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function ApiAccessClient({ baseUrl, usdtAddress, subscriptionPriceUsd, subscriptionDays }: Props) {
  const t = useTranslations('apiPage');
  const snippets = useMemo(() => buildRateApiDocSnippets(baseUrl), [baseUrl]);
  const [docTab, setDocTab] = useState(snippets[0]?.id ?? 'curl');

  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch('/api/api-access/submit', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMsg({ type: 'err', text: data.error || t('error') });
      } else {
        setMsg({ type: 'ok', text: t('success') });
        form.reset();
      }
    } catch {
      setMsg({ type: 'err', text: t('error') });
    } finally {
      setPending(false);
    }
  }

  const activeSnippet = snippets.find((s) => s.id === docTab);

  return (
    <div className="space-y-12">
      <section className="rounded-xl border border-border/80 bg-card/40 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">{t('formTitle')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('formHint')}</p>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={onSubmit}>
          <div className="sm:col-span-2">
            <Label htmlFor="fullName">{t('fullName')}</Label>
            <Input id="fullName" name="fullName" required className="mt-1" dir="auto" />
          </div>
          <div>
            <Label htmlFor="email">{t('email')}</Label>
            <Input id="email" name="email" type="email" required className="mt-1" dir="ltr" />
          </div>
          <div>
            <Label htmlFor="phone">{t('phone')}</Label>
            <Input id="phone" name="phone" type="tel" required className="mt-1" dir="ltr" />
          </div>
          <div>
            <Label htmlFor="websiteName">{t('websiteName')}</Label>
            <Input id="websiteName" name="websiteName" required className="mt-1" dir="auto" />
          </div>
          <div>
            <Label htmlFor="websiteUrl">{t('websiteUrl')}</Label>
            <Input
              id="websiteUrl"
              name="websiteUrl"
              type="text"
              placeholder="example.com أو https://example.com"
              required
              className="mt-1"
              dir="ltr"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="usagePurpose">{t('usagePurpose')}</Label>
            <Input id="usagePurpose" name="usagePurpose" required className="mt-1" dir="auto" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="programmingType">{t('programmingType')}</Label>
            <Input id="programmingType" name="programmingType" required className="mt-1" dir="auto" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="receipt">{t('receipt')}</Label>
            <Input id="receipt" name="receipt" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1" />
          </div>
          {msg && (
            <p
              className={`sm:col-span-2 text-sm ${msg.type === 'ok' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
              role="status"
            >
              {msg.text}
            </p>
          )}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? t('sending') : t('submit')}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-border/80 bg-card/40 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">{t('payTitle')}</h2>
        <p className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm font-medium text-foreground">
          {t('payPricing', {
            price: formatUsdPrice(subscriptionPriceUsd),
            days: subscriptionDays,
          })}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t('payAutoExpire')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('payNote')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('network')}</p>
        {usdtAddress ? (
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
            <div className="rounded-lg bg-white p-3 shadow-inner">
              <QRCodeSVG value={usdtAddress} size={160} />
            </div>
            <div className="max-w-full text-center sm:text-start">
              <p className="text-xs font-medium text-muted-foreground">{t('usdtLabel')}</p>
              <p className="mt-2 break-all font-mono text-sm text-foreground" dir="ltr">
                {usdtAddress}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">{t('noWallet')}</p>
        )}
      </section>

      <section className="rounded-xl border border-border/80 bg-card/40 p-6 shadow-sm backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">{t('docTitle')}</h2>
        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{t('docIntro')}</p>
        <p className="mt-2 font-mono text-xs text-primary break-all" dir="ltr">
          GET {baseUrl.replace(/\/$/, '')}/api/rates
        </p>

        <Tabs value={docTab} onValueChange={setDocTab} className="mt-6 w-full">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
            {snippets.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="text-xs">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={docTab} className="mt-4">
            {activeSnippet && (
              <pre className="max-h-[420px] overflow-auto rounded-lg border border-border bg-muted/50 p-4 text-xs leading-relaxed" dir="ltr">
                <code>{activeSnippet.code}</code>
              </pre>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <div className="text-center">
        <Link href="/" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
