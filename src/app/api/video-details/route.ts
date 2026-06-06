import { NextRequest, NextResponse } from 'next/server';
import xvideos from '@/lib/scraper/index';
import { cacheWrap, TTL } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const result = await cacheWrap(
      `details:url=${url}`,
      () => xvideos.videos.details({ url }),
      TTL.DETAILS,
    );
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
