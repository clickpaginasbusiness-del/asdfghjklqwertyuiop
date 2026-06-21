import type { Metadata } from 'next'
import LandingPage from '@/components/landing/LandingPage'
import { SITE_URL } from '@/lib/seo'

const TITLE = 'BelleBook — Agendamento Online para Profissionais de Beleza'
const DESCRIPTION =
  'Crie sua página de agendamento profissional, receba clientes 24h e gerencie seu negócio de beleza. Grátis por 30 dias.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'agendamento online',
    'nail designer',
    'manicure',
    'salão de beleza',
    'agenda online',
    'agendamento gratuito',
    'sistema de agendamento',
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'BelleBook',
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: [
    {
      '@type': 'Offer',
      name: 'Plano Básico',
      price: '49.00',
      priceCurrency: 'BRL',
      url: `${SITE_URL}/planos`,
    },
    {
      '@type': 'Offer',
      name: 'Plano Pro',
      price: '89.00',
      priceCurrency: 'BRL',
      url: `${SITE_URL}/planos`,
    },
  ],
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  )
}
