'use client';

import { Outfit, Cormorant_Garamond } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { useState } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '113312114754-jgrmepitvnm33ft190drb72t9d4omgvf.apps.googleusercontent.com';

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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <html lang="es" className={`dark ${outfit.variable} ${cormorantGaramond.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#130F07" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DPH Seller" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/png" href="/icons/dp-logo-full.png" />
        <title>D Perfume House - Vendedor</title>
        <meta name="description" content="App de ventas para vendedores de D Perfume House" />
      </head>
      <body className={`${outfit.className} font-sans`}>
        <div className="mx-auto w-full max-w-[600px] min-h-screen">
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <QueryClientProvider client={queryClient}>
              <ToastProvider>
                {children}
              </ToastProvider>
            </QueryClientProvider>
          </GoogleOAuthProvider>
        </div>
      </body>
    </html>
  );
}
