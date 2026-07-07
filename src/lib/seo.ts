export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL!

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString()
}
