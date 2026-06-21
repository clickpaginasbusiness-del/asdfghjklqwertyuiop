import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PerfilPublicoClient from './PerfilPublicoClient'
import { SITE_URL } from '@/lib/seo'

export default async function PerfilPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!prestadora) notFound()

  const [
    { data: servicos },
    { data: galeria },
    { data: diasBloqueados },
    { data: profissionais },
    { data: horariosFuncionamento },
    { data: avaliacoes },
  ] = await Promise.all([
    supabase.from('servicos').select('*, servico_profissionais(profissional_id)').eq('prestadora_id', prestadora.id).eq('ativo', true).order('nome'),
    supabase.from('galeria').select('*').eq('prestadora_id', prestadora.id).order('created_at', { ascending: false }),
    supabase.from('dias_bloqueados').select('data').eq('prestadora_id', prestadora.id),
    supabase.from('profissionais').select('*').eq('prestadora_id', prestadora.id).eq('ativa', true).order('nome'),
    supabase.from('horarios_funcionamento').select('*').eq('prestadora_id', prestadora.id).order('dia_semana'),
    supabase.from('avaliacoes').select('*').eq('prestadora_id', prestadora.id).order('created_at', { ascending: false }),
  ])

  return (
    <PerfilPublicoClient
      prestadora={prestadora}
      servicos={servicos ?? []}
      galeria={galeria ?? []}
      diasBloqueados={(diasBloqueados ?? []).map((d) => d.data)}
      profissionais={profissionais ?? []}
      horariosFuncionamento={horariosFuncionamento ?? []}
      avaliacoes={avaliacoes ?? []}
    />
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('prestadoras').select('nome, bio, foto_url').eq('slug', slug).single()
  if (!data) return {}

  const title = `${data.nome} — BelleBook`
  const description = data.bio ?? `Agende seu horário com ${data.nome}`
  const url = `${SITE_URL}/n/${slug}`
  const image = data.foto_url ?? '/og-image.png'

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'BelleBook',
      locale: 'pt_BR',
      type: 'profile',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  }
}
