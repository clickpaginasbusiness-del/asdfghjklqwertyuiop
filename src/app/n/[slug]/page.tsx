import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import PerfilPublicoClient from './PerfilPublicoClient'
import PerfilPublicoLandingClient from './PerfilPublicoLandingClient'
import PerfilPublicoLandingPremiumClient from './PerfilPublicoLandingPremiumClient'
import { SITE_URL } from '@/lib/seo'
import { planoEfetivo } from '@/lib/plano'
import { limitesPlano } from '@/lib/planoLimites'
import type { PlanoPublico } from '@/components/perfil-publico/PlanosSection'

// Colunas seguras pra expor num contexto público/anônimo — exclui email,
// telefone, dados de pagamento (mp_*), chave Pix de parceira etc. Usa
// service role de propósito: essa página não tem sessão de usuário (é
// pública), então depender de RLS pra restringir colunas não funciona
// (RLS é por linha, não por coluna) — a lista explícita abaixo é o que
// garante que só dado público sai daqui. Ver PrestadoraPublica em types.ts.
const COLUNAS_PUBLICAS = 'id, nome, bio, foto_url, slug, cor_tema, whatsapp, instagram, endereco, plano, e_parceira, hora_abertura, hora_fechamento, pagina_texto_agendamento, pagina_mostrar_texto_agendamento, pagina_mostrar_estrelas, pagina_mostrar_avaliacoes, pagina_mostrar_galeria, pagina_galeria_modo, pagina_galeria_fotos_ids, pagina_mostrar_estabelecimento, pagina_estabelecimento_modo, pagina_estabelecimento_fotos_ids, pagina_estabelecimento_titulo, pagina_preset, pagina_banner_foto_id'

// ISR: essa é a página de maior tráfego do app (perfil público, sem sessão),
// e até agora renderizava 100% dinâmico — buscava tudo do banco a cada
// request. Os dados aqui (bio, serviços, galeria, horários...) mudam pouco;
// disponibilidade de horário é vazão à parte, buscada ao vivo pelo cliente
// via /api/agendamentos/horarios-ocupados, então cachear esse shell não
// arrisca overbooking. 60s equilibra "edições da prestadora aparecem rápido"
// com "não bate no banco a cada visita".
export const revalidate = 60

export default async function PerfilPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select(COLUNAS_PUBLICAS)
    .eq('slug', slug)
    .single()

  if (!prestadora) notFound()

  // Presets "landing" e "premium" são exclusivos do Studio/Studio Pro — se a
  // prestadora escolheu um deles e depois caiu pra um plano sem acesso (ex.:
  // downgrade), volta pro clássico automaticamente. A escolha continua salva
  // no banco (pagina_preset), só a renderização é que respeita o plano atual.
  const planoAtual = planoEfetivo({ plano: prestadora.plano, e_parceira: prestadora.e_parceira })
  const temAcessoAPresets = limitesPlano(planoAtual).presets
  const presetEfetivo = temAcessoAPresets && (prestadora.pagina_preset === 'landing' || prestadora.pagina_preset === 'premium')
    ? prestadora.pagina_preset
    : 'classico'

  // Planos de assinatura pra clientes são exclusivos do Studio/Studio Pro
  // (mesmo gate de `assinaturas_clientes` em planoLimites.ts) — se a
  // prestadora caiu pra um plano sem acesso, a seção simplesmente some da
  // página pública (os planos continuam salvos no banco, só não aparecem).
  const temAcessoAPlanos = limitesPlano(planoAtual).assinaturas_clientes

  const [
    { data: servicos },
    { data: galeria },
    { data: diasBloqueados },
    { data: profissionais },
    { data: horariosFuncionamento },
    { data: avaliacoes },
    { data: planos },
  ] = await Promise.all([
    supabase.from('servicos').select('*, servico_profissionais(profissional_id)').eq('prestadora_id', prestadora.id).eq('ativo', true).order('nome'),
    supabase.from('galeria').select('*').eq('prestadora_id', prestadora.id).order('created_at', { ascending: false }),
    supabase.from('dias_bloqueados').select('data').eq('prestadora_id', prestadora.id),
    supabase.from('profissionais').select('*').eq('prestadora_id', prestadora.id).eq('ativa', true).order('nome'),
    supabase.from('horarios_funcionamento').select('*').eq('prestadora_id', prestadora.id).order('dia_semana'),
    supabase.from('avaliacoes').select('*, agendamentos(clientes(nome))').eq('prestadora_id', prestadora.id).order('created_at', { ascending: false }),
    temAcessoAPlanos
      ? supabase
          .from('planos_prestadora')
          .select('id, nome, descricao, preco, intervalo, desconto_tipo, desconto_valor, limite_vagas, planos_servicos(quantidade, servicos(nome)), planos_assinaturas(status)')
          .eq('prestadora_id', prestadora.id)
          .eq('ativo', true)
          .order('preco')
      : Promise.resolve({ data: null }),
  ])

  type PlanoRow = {
    id: string
    nome: string
    descricao: string | null
    preco: number
    intervalo: PlanoPublico['intervalo']
    desconto_tipo: PlanoPublico['desconto_tipo']
    desconto_valor: number
    limite_vagas: number | null
    planos_servicos: { quantidade: number; servicos: { nome: string } | null }[] | null
    planos_assinaturas: { status: string }[] | null
  }

  const planosPublicos: PlanoPublico[] = ((planos ?? []) as unknown as PlanoRow[]).map((p) => ({
    id: p.id,
    nome: p.nome,
    descricao: p.descricao,
    preco: p.preco,
    intervalo: p.intervalo,
    desconto_tipo: p.desconto_tipo,
    desconto_valor: p.desconto_valor,
    limite_vagas: p.limite_vagas,
    vagasOcupadas: (p.planos_assinaturas ?? []).filter((a) => a.status === 'ativa').length,
    servicos: (p.planos_servicos ?? []).map((ps) => ({ nome: ps.servicos?.nome ?? '', quantidade: ps.quantidade })),
  }))

  const props = {
    prestadora,
    servicos: servicos ?? [],
    galeria: galeria ?? [],
    diasBloqueados: (diasBloqueados ?? []).map((d) => d.data),
    profissionais: profissionais ?? [],
    horariosFuncionamento: horariosFuncionamento ?? [],
    avaliacoes: avaliacoes ?? [],
    planos: planosPublicos,
  }

  if (presetEfetivo === 'premium') return <PerfilPublicoLandingPremiumClient {...props} />
  if (presetEfetivo === 'landing') return <PerfilPublicoLandingClient {...props} />
  return <PerfilPublicoClient {...props} />
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()
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
