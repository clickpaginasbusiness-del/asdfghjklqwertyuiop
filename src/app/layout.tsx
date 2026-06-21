import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import { SITE_URL } from '@/lib/seo'

const TITLE = 'BelleBook — Agendamento para Profissionais de Beleza'
const DESCRIPTION = 'A plataforma mais elegante para profissionais de beleza gerenciarem seus agendamentos'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    title: 'BelleBook',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'BelleBook',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BelleBook' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/og-image.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f9a8c9',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <ServiceWorkerRegister />
        <InstallPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: '#fff',
              color: '#1a1a1a',
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#f9a8c9', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}
