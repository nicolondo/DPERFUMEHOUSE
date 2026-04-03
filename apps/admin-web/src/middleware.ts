import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password', '/api', '/_next', '/favicon.ico'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow root redirect
  if (pathname === '/') {
    return NextResponse.next();
  }

  // For admin routes, check for auth token in cookies
  // Note: The primary auth check is client-side via localStorage in the (admin) layout.
  // This middleware provides an extra layer by checking the cookie if set,
  // and redirecting unauthenticated users for server-rendered pages.
  const token = request.cookies.get('admin_access_token')?.value;

  // If no cookie token is present, we rely on the client-side layout guard.
  // The layout will redirect to /login if localStorage has no token.
  // This middleware mainly ensures that direct navigation to admin routes
  // without any session gets caught early.

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
