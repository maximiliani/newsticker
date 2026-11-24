'use server';

import {cookies} from 'next/headers';
import {COOKIE_NAME, isSupportedLocale} from './config';

export async function setLocaleCookie(locale: string) {
  if (!isSupportedLocale(locale)) throw new Error('Unsupported locale');
  (await cookies()).set(COOKIE_NAME, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
