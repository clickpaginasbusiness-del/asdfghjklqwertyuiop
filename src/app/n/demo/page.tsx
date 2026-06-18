import PerfilPublicoClient from '../[slug]/PerfilPublicoClient'
import type { Prestadora, Servico, GaleriaItem, Profissional, HorarioFuncionamento } from '@/lib/types'

const DEMO_PRESTADORA: Prestadora = {
  id: 'demo',
  user_id: 'demo',
  nome: 'Ana Nails Studio',
  email: 'ana@demo.com',
  slug: 'demo',
  bio: 'Nail designer apaixonada por unhas perfeitas. Mais de 8 anos de experiência em manicure, pedicure e nail art. Atendo com amor e dedicação cada cliente.',
  foto_url: null,
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
  cor_tema: 'rosa',
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

const DEMO_SERVICOS: Servico[] = [
  {
    id: 's1', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Manicure',
    preco: 35,
    duracao_minutos: 30,
    descricao: 'Cutilagem, esmaltação e hidratação das mãos.',
  },
  {
    id: 's2', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Pedicure',
    preco: 55,
    duracao_minutos: 60,
    descricao: 'Cutilagem, esmaltação e esfoliação dos pés.',
  },
  {
    id: 's3', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Nail art básica',
    preco: 70,
    duracao_minutos: 90,
    descricao: 'Decoração artística nas unhas com glitter, strass e estampas.',
  },
  {
    id: 's4', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Alongamento em gel',
    preco: 150,
    duracao_minutos: 120,
    descricao: 'Extensão das unhas em gel com formato e comprimento personalizados.',
  },
  {
    id: 's5', prestadora_id: 'demo', ativo: true, created_at: '',
    nome: 'Manutenção de gel',
    preco: 90,
    duracao_minutos: 60,
    descricao: 'Reequilíbrio e esmaltação das unhas em gel com preenchimento da raiz.',
  },
]

const DEMO_PROFISSIONAIS: Profissional[] = [
  {
    id: 'p1', prestadora_id: 'demo', ativa: true, created_at: '',
    nome: 'Ana',
    foto_url: null,
    bio: 'Proprietária e especialista em nail art e alongamento de gel',
    dias_semana: [1, 2, 3, 4, 5],
    hora_abertura: null,
    hora_fechamento: null,
  },
  {
    id: 'p2', prestadora_id: 'demo', ativa: true, created_at: '',
    nome: 'Camila',
    foto_url: null,
    bio: 'Especialista em alongamento de gel e manutenção',
    dias_semana: [2, 4, 6],
    hora_abertura: null,
    hora_fechamento: null,
  },
  {
    id: 'p3', prestadora_id: 'demo', ativa: true, created_at: '',
    nome: 'Letícia',
    foto_url: null,
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

export const metadata = {
  title: 'Ana Nails Studio — Exemplo BelleBook',
  description: 'Veja como fica sua página de agendamento no BelleBook',
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
        isDemo
      />
    </div>
  )
}
