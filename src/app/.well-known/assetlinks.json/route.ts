import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'com.ymcsystems.bellebook',
        sha256_cert_fingerprints: [
          'C1:96:F6:5C:64:20:82:86:B3:5C:D2:E5:93:AE:06:69:50:31:D6:49:1B:0F:94:70:DA:F2:27:3A:08:FE:1D:E5'
        ]
      }
    }
  ])
}
