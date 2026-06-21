export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nailbook-eta.vercel.app'

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}
