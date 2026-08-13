import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.bellebook.app',
        sha256_cert_fingerprints: [
          '1D:29:19:1F:42:8A:75:0A:74:64:C6:0E:D7:A1:4A:FA:E1:99:29:BF:56:0B:3F:1D:72:0D:7A:95:F4:C3:A4:9A',
          'F8:29:AE:68:65:D2:A0:E6:97:A8:94:02:C0:42:B6:AD:47:C9:87:E6:7D:93:A2:D7:01:F5:21:12:8C:A0:56:E3'
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
