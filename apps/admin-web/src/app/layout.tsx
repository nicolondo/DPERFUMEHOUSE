'use client';

import { Outfit, Cormorant_Garamond } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['300', '400', '500', '600'],
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ['latin'],
  variable: '--font-cormorant',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`dark ${outfit.variable} ${cormorantGaramond.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#130F07" />
        <link rel="icon" type="image/png" href="/icons/dp-logo-full.png" />
        <title>D Perfume House - Admin</title>
        <meta name="description" content="Panel de administracion de D Perfume House" />
      </head>
      <body className={`${outfit.className} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
