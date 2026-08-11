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

/** Heurística pra extrair a cidade de um endereço em texto livre — não há
 * campo estruturado de cidade no cadastro (ver `endereco` na Prestadora),
 * só um textarea livre. Assume o formato comum "..., Cidade, UF" (a UF de 2
 * letras no fim indica que a cidade é o pedaço anterior) ou, na falta disso,
 * usa o último pedaço separado por vírgula como melhor palpite. Retorna
 * null se o endereço não tiver vírgula nenhuma (não dá pra confiar num
 * palpite melhor que isso). */
function extrairCidade(endereco: string | null): string | null {
  if (!endereco) return null
  const partes = endereco.split(',').map((p) => p.trim()).filter(Boolean)
  if (partes.length < 2) return null
  const ultima = partes[partes.length - 1]
  if (/^[a-zA-Z]{2}$/.test(ultima)) return partes[partes.length - 2]
  return ultima
}

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

  // Presets "landing" e "premium" são exclusivos do Studio — se a
  // prestadora escolheu um deles e depois caiu pra um plano sem acesso (ex.:
  // downgrade), volta pro clássico automaticamente. A escolha continua salva
  // no banco (pagina_preset), só a renderização é que respeita o plano atual.
  const planoAtual = planoEfetivo({ plano: prestadora.plano, e_parceira: prestadora.e_parceira })
  const temAcessoAPresets = limitesPlano(planoAtual).presets
  const presetEfetivo = temAcessoAPresets && (prestadora.pagina_preset === 'landing' || prestadora.pagina_preset === 'premium')
    ? prestadora.pagina_preset
    : 'classico'

  // Planos de assinatura pra clientes são exclusivos do Studio
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

  // Schema.org LocalBusiness — "business.business" (og:type) e o @type de
  // BeautySalon/HealthAndBeautyBusiness não têm campo dedicado na Metadata
  // API tipada do Next (o union de OpenGraphType não inclui tipos
  // business.*), então são emitidos aqui como tags soltas no corpo da
  // página — o React 19 hoisteia <meta>/<script> renderizados em qualquer
  // profundidade da árvore pra dentro de <head> automaticamente.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['BeautySalon', 'HealthAndBeautyBusiness'],
    name: prestadora.nome,
    description: prestadora.bio || undefined,
    url: `${SITE_URL}/n/${slug}`,
    telephone: prestadora.whatsapp || undefined,
    address: prestadora.endereco || undefined,
    image: prestadora.foto_url || undefined,
  }

  return (
    <>
      <meta property="og:type" content="business.business" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {presetEfetivo === 'premium' ? <PerfilPublicoLandingPremiumClient {...props} />
        : presetEfetivo === 'landing' ? <PerfilPublicoLandingClient {...props} />
        : <PerfilPublicoClient {...props} />}
    </>
  )
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('prestadoras').select('id, nome, bio, foto_url, endereco').eq('slug', slug).single()
  if (!data) return {}

  const { data: servicos } = await supabase
    .from('servicos')
    .select('nome')
    .eq('prestadora_id', data.id)
    .eq('ativo', true)

  const cidade = extrairCidade(data.endereco)
  const bioLimpa = data.bio?.trim().replace(/[.!?]+$/, '') || null

  const title = `${data.nome}${cidade ? ` — ${cidade}` : ''} | Agendamento Online`
  const description = `Agende online com ${data.nome}. ${bioLimpa || 'Serviços de beleza com agendamento online 24h'}. Sem precisar ligar ou enviar mensagem!`
  const url = `${SITE_URL}/n/${slug}`
  const image = data.foto_url ?? '/og-image.png'
  const keywords = [data.nome, cidade, ...(servicos ?? []).map((s) => s.nome)].filter((v): v is string => Boolean(v))

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url,
      siteName: 'BelleBook',
      locale: 'pt_BR',
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
