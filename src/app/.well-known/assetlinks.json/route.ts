import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.ymcsystems.bellebook',
        sha256_cert_fingerprints: [
          '1D:29:19:1F:42:8A:75:0A:74:64:C6:0E:D7:A1:4A:FA:E1:99:29:BF:56:0B:3F:1D:72:0D:7A:95:F4:C3:A4:9A'
        ]
      }
    }
  ], {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}
