import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const embedUrl = request.nextUrl.searchParams.get('url');

  if (!embedUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  // Only allow proxying xvideos embed URLs
  if (!embedUrl.startsWith('https://www.xvideos.com/embedframe/')) {
    return NextResponse.json({ error: 'Invalid embed URL' }, { status: 400 });
  }

  try {
    const response = await fetch(embedUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10_000),
    });

    const html = await response.text();

    // Return the embed HTML without restrictive headers
    return new NextResponse(html, {
      status: response.status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Allow embedding from any origin
        'access-control-allow-origin': '*',
        // Permissive CSP to allow xvideos embed scripts to load
        'content-security-policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;",
        'cross-origin-opener-policy': 'unsafe-none',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const errorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;background:#000;height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;font-size:14px;color:#666">
      <div style="text-align:center"><p>Embed unavailable</p><p style="font-size:12px;color:#444">${msg}</p></div>
    </body></html>`;
    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
}
