import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BelleBook',
    short_name: 'BelleBook',
    description: 'A plataforma mais elegante para profissionais de beleza gerenciarem seus agendamentos',
    start_url: '/painel',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff7fa',
    theme_color: '#f9a8c9',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
