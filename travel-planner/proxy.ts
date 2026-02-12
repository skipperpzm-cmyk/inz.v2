import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const USER = process.env.TUNNEL_USER;
const PASS = process.env.TUNNEL_PASS;
const EXPECTED = USER && PASS ? `${USER}:${PASS}` : null;

export function proxy(req: NextRequest) {
  if (!EXPECTED) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // allow static assets and internal next paths
  if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Allow select invitation/profile lookup API endpoints to bypass tunnel
  // Basic Auth so ngrok-tunneled recipients can receive and accept
  // invites without entering the tunnel credentials. Keep this narrow
  // to only the endpoints used by the invite flow.
  const allowedPrefixes = ['/api/friend-invites', '/api/u', '/api/profiles/search'];
  for (const p of allowedPrefixes) {
    if (pathname.startsWith(p)) return NextResponse.next();
  }

  const auth = req.headers.get('authorization');
  if (auth && auth.startsWith('Basic ')) {
    try {
      const b64 = auth.split(' ')[1];
      const decoded = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString();
      if (decoded === EXPECTED) return NextResponse.next();
    } catch (e) {
      // fall through to unauthorized
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Restricted"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
