import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/q'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // Check for access token in cookies or rely on client-side check
  const token = request.cookies.get('access_token')?.value;

  // Since we use localStorage for tokens, we check via a custom header or
  // simply redirect unauthenticated root requests to login.
  // The real auth guard is in the (app)/layout.tsx client component.
  // This middleware handles the initial redirect for the root path.
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // For protected routes, if there's no token cookie, let the client-side
  // layout handle the redirect (since tokens are in localStorage)
  if (!token && !pathname.startsWith('/login')) {
    // We don't redirect here because tokens are in localStorage,
    // which middleware can't access. The (app)/layout.tsx handles this.
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json).*)'],
};
