import type { Metadata } from 'next'
import PerfilPublicoClient, { type ServicoComProfissionais } from '../[slug]/PerfilPublicoClient'
import type { Prestadora, GaleriaItem, Profissional, HorarioFuncionamento, Avaliacao } from '@/lib/types'
import { SITE_URL } from '@/lib/seo'

const DEMO_PRESTADORA: Prestadora = {
  id: 'demo',
  user_id: 'demo',
  nome: 'Ana Nails Studio',
  email: 'ana@demo.com',
  slug: 'demo',
  bio: 'Nail designer apaixonada por unhas perfeitas. Mais de 8 anos de experiência em manicure, pedicure e nail art. Atendo com amor e dedicação cada cliente.',
  foto_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
  hora_abertura: '09:00',
  hora_fechamento: '18:00',
  whatsapp: '11999999999',
  instagram: 'ana.nails.studio',
  endereco: 'Rua das Flores, 123 — Vila Madalena, São Paulo, SP',
  telefone: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  plano: 'pro' as const,
  assinatura_ativa: true,
  trial_fim: null,
  e_trial: false,
  downgrade_aviso: false,
  trial_pro_usado: false,
  trial_pro_fim: null,
  cor_tema: 'rosa',
  mensagem_confirmacao: null,
  mensagem_cancelamento: null,
  mensagem_lembrete: null,
  codigo_indicacao: null,
  indicado_por: null,
  indicacao_recompensa_processada: false,
  last_seen_at: null,
  created_at: new Date().toISOString(),
}

// 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
const DEMO_HORARIOS: HorarioFuncionamento[] = [
  { id: 'h0', prestadora_id: 'demo', dia_semana: 0, ativo: false, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'h1', prestadora_id: 'demo', dia_semana: 1, ativo: true,  hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'h2', prestadora_id: 'demo', dia_semana: 2, ativo: true,  hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'h3', prestadora_id: 'demo', dia_semana: 3, ativo: true,  hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'h4', prestadora_id: 'demo', dia_semana: 4, ativo: true,  hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'h5', prestadora_id: 'demo', dia_semana: 5, ativo: true,  hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'h6', prestadora_id: 'demo', dia_semana: 6, ativo: true,  hora_abertura: '09:00', hora_fechamento: '13:00' },
]

const DEMO_SERVICOS: ServicoComProfissionais[] = [
  {
    id: 's1', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Manicure',
    preco: 35,
    duracao_minutos: 30,
    descricao: 'Cutilagem, esmaltação e hidratação das mãos.',
    servico_profissionais: [],
  },
  {
    id: 's2', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Pedicure',
    preco: 55,
    duracao_minutos: 60,
    descricao: 'Cutilagem, esmaltação e esfoliação dos pés.',
    servico_profissionais: [],
  },
  {
    id: 's3', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Nail art básica',
    preco: 70,
    duracao_minutos: 90,
    descricao: 'Decoração artística nas unhas com glitter, strass e estampas.',
    servico_profissionais: [],
  },
  {
    id: 's4', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Alongamento em gel',
    preco: 150,
    duracao_minutos: 120,
    descricao: 'Extensão das unhas em gel com formato e comprimento personalizados.',
    servico_profissionais: [],
  },
  {
    id: 's5', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Manutenção de gel',
    preco: 90,
    duracao_minutos: 60,
    descricao: 'Reequilíbrio e esmaltação das unhas em gel com preenchimento da raiz.',
    servico_profissionais: [],
  },
]

const DEMO_PROFISSIONAIS: Profissional[] = [
  {
    id: 'p1', prestadora_id: 'demo', ativa: true, created_at: '',
    nome: 'Ana',
    foto_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
    bio: 'Proprietária e especialista em nail art e alongamento de gel',
    dias_semana: [1, 2, 3, 4, 5],
    hora_abertura: null,
    hora_fechamento: null,
  },
  {
    id: 'p2', prestadora_id: 'demo', ativa: true, created_at: '',
    nome: 'Camila',
    foto_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
    bio: 'Especialista em alongamento de gel e manutenção',
    dias_semana: [2, 4, 6],
    hora_abertura: null,
    hora_fechamento: null,
  },
  {
    id: 'p3', prestadora_id: 'demo', ativa: true, created_at: '',
    nome: 'Letícia',
    foto_url: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80',
    bio: 'Expert em nail art e decoração artística',
    dias_semana: [1, 3, 5],
    hora_abertura: null,
    hora_fechamento: null,
  },
]

const DEMO_GALERIA: GaleriaItem[] = [
  {
    id: 'g1', prestadora_id: 'demo', tipo: 'imagem', created_at: '',
    url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&q=80',
  },
  {
    id: 'g2', prestadora_id: 'demo', tipo: 'imagem', created_at: '',
    url: 'https://images.unsplash.com/photo-1604902396830-aca29e19b067?w=400&q=80',
  },
  {
    id: 'g3', prestadora_id: 'demo', tipo: 'imagem', created_at: '',
    url: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=400&q=80',
  },
  {
    id: 'g4', prestadora_id: 'demo', tipo: 'imagem', created_at: '',
    url: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400&q=80',
  },
  {
    id: 'g5', prestadora_id: 'demo', tipo: 'imagem', created_at: '',
    url: 'https://images.unsplash.com/photo-1607779097040-26e80aa78e66?w=400&q=80',
  },
  {
    id: 'g6', prestadora_id: 'demo', tipo: 'imagem', created_at: '',
    url: 'https://images.unsplash.com/photo-1612887390768-fb02affea7a6?w=400&q=80',
  },
]

const DEMO_AVALIACOES: Avaliacao[] = [
  { id: 'av1', agendamento_id: 'a1', prestadora_id: 'demo', nota: 5, comentario: 'Atendimento incrível, super atenciosa! Minhas unhas ficaram perfeitas.', destaque: true, created_at: '2026-06-10T12:00:00Z' },
  { id: 'av2', agendamento_id: 'a2', prestadora_id: 'demo', nota: 5, comentario: 'Profissional excelente, ambiente acolhedor. Recomendo demais!', destaque: true, created_at: '2026-06-05T12:00:00Z' },
  { id: 'av3', agendamento_id: 'a3', prestadora_id: 'demo', nota: 4, comentario: 'Muito bom, só achei o horário um pouco apertado.', destaque: false, created_at: '2026-05-28T12:00:00Z' },
]

const TITLE = 'Ana Nails Studio — Exemplo BelleBook'
const DESCRIPTION = 'Veja como fica sua página de agendamento no BelleBook'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/n/demo` },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/n/demo`,
    siteName: 'BelleBook',
    locale: 'pt_BR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'BelleBook' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/og-image.png'] },
}

export default function DemoPage() {
  return (
    <div className="relative">
      <div className="bg-rose-400 text-white text-center py-2 px-4 text-sm font-medium">
        Página de demonstração — <a href="/painel/cadastro" className="underline font-semibold">Crie a sua grátis</a>
      </div>
      <PerfilPublicoClient
        prestadora={DEMO_PRESTADORA}
        servicos={DEMO_SERVICOS}
        galeria={DEMO_GALERIA}
        diasBloqueados={[]}
        profissionais={DEMO_PROFISSIONAIS}
        horariosFuncionamento={DEMO_HORARIOS}
        avaliacoes={DEMO_AVALIACOES}
        isDemo
      />
    </div>
  )
}
