'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const languages = [
  { code: 'ar', name: 'العربية', flag: '🇸🇾' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export function LanguageSwitcher({ triggerClassName }: { triggerClassName?: string }) {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState('ar');

  useEffect(() => {
    const getLocale = async () => {
      try {
        const response = await fetch('/api/settings/locale');
        if (response.ok) {
          const data = await response.json();
          if (data.locale) {
            setCurrentLocale(data.locale);
          }
        }
      } catch (error) {
        const aborted =
          error instanceof DOMException &&
          (error.name === 'AbortError' || error.name === 'TimeoutError');
        if (!aborted) console.error('Failed to get locale:', error);
      }
    };
    getLocale();
  }, []);

  const changeLanguage = async (newLocale: string) => {
    try {
      await fetch('/api/settings/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: newLocale }),
      });
      setCurrentLocale(newLocale);
      router.refresh();
    } catch (error) {
      const aborted =
        error instanceof DOMException &&
        (error.name === 'AbortError' || error.name === 'TimeoutError');
      if (!aborted) console.error('Failed to change language:', error);
    }
  };

  const currentLang = languages.find((l) => l.code === currentLocale) || languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={`gap-2 ${triggerClassName ?? ''}`}>
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLang.flag} {currentLang.name}
          </span>
          <span className="sm:hidden">{currentLang.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="z-[200] min-w-[10rem]">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            className={cn(
              'cursor-pointer gap-2',
              currentLocale === lang.code && 'bg-accent text-accent-foreground'
            )}
            onSelect={() => {
              void changeLanguage(lang.code);
            }}
          >
            <span>{lang.flag}</span>
            <span>{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
