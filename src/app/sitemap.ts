import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/planos`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/n/demo`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/termos`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/privacidade`, changeFrequency: 'yearly', priority: 0.3 },
  ]

  const supabase = await createClient()
  const { data: prestadoras } = await supabase
    .from('prestadoras')
    .select('slug, created_at')

  const prestadoraPages: MetadataRoute.Sitemap = (prestadoras ?? []).map((p) => ({
    url: `${SITE_URL}/n/${p.slug}`,
    lastModified: p.created_at ? new Date(p.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  return [...staticPages, ...prestadoraPages]
}
