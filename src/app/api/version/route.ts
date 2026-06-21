import { NextResponse } from 'next/server'
import { BUILD_ID } from '@/lib/buildId.generated'

export async function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
