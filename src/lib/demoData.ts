import { addDays, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns'
import toast from 'react-hot-toast'
import type {
  Prestadora, Profissional, Cliente, Servico, Agendamento, HorarioFuncionamento, Avaliacao,
} from '@/lib/types'

/* ── Toast padrão para ações "reais" na demo ── */
export function demoToast() {
  toast('Esta é uma demonstração — crie sua conta para usar de verdade', { icon: '👀' })
}

function em(diasOffset: number, hora: number, minuto: number): string {
  const base = setSeconds(setMinutes(setHours(startOfDay(addDays(new Date(), diasOffset)), hora), minuto), 0)
  return base.toISOString()
}

export const DEMO_PRESTADORA: Prestadora = {
  id: 'demo-prestadora',
  user_id: 'demo-user',
  nome: 'Ana Nails Studio',
  email: 'ana@demo.com',
  slug: 'demo',
  bio: 'Nail designer apaixonada por unhas perfeitas. Mais de 8 anos de experiência em manicure, pedicure e nail art. Atendo com amor e dedicação cada cliente.',
  foto_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
  hora_abertura: '09:00:00',
  hora_fechamento: '18:00:00',
  whatsapp: '31999990000',
  instagram: 'ana.nails.studio',
  endereco: 'Rua das Flores, 123 — Vila Madalena, São Paulo, SP',
  telefone: null,
  stripe_customer_id: null,
  stripe_subscription_id: 'demo_sub',
  plano: 'pro',
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
  created_at: '2025-01-15T12:00:00Z',
}

export const DEMO_PROFISSIONAIS: Profissional[] = [
  {
    id: 'demo-prof-ana',
    prestadora_id: 'demo-prestadora',
    nome: 'Ana',
    foto_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80',
    bio: 'Proprietária, especialista em nail art e alongamento em gel',
    ativa: true,
    dias_semana: null,
    hora_abertura: null,
    hora_fechamento: null,
    created_at: '2025-01-15T12:00:00Z',
  },
  {
    id: 'demo-prof-carol',
    prestadora_id: 'demo-prestadora',
    nome: 'Carol',
    foto_url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&q=80',
    bio: 'Especialista em esmaltação em gel e cuidados com unhas',
    ativa: true,
    dias_semana: null,
    hora_abertura: null,
    hora_fechamento: null,
    created_at: '2025-02-01T12:00:00Z',
  },
]

export const DEMO_CLIENTES: Cliente[] = [
  { id: 'demo-cli-maria', nome: 'Maria Silva', telefone: '31999991111', verificado_em: '2025-03-01T12:00:00Z', created_at: '2025-03-01T12:00:00Z' },
  { id: 'demo-cli-julia', nome: 'Júlia Santos', telefone: '31999992222', verificado_em: '2025-03-10T12:00:00Z', created_at: '2025-03-10T12:00:00Z' },
  { id: 'demo-cli-fernanda', nome: 'Fernanda Costa', telefone: '31999993333', verificado_em: '2025-04-02T12:00:00Z', created_at: '2025-04-02T12:00:00Z' },
  { id: 'demo-cli-camila', nome: 'Camila Oliveira', telefone: '31999994444', verificado_em: '2025-04-20T12:00:00Z', created_at: '2025-04-20T12:00:00Z' },
  { id: 'demo-cli-beatriz', nome: 'Beatriz Lima', telefone: '31999995555', verificado_em: '2025-05-05T12:00:00Z', created_at: '2025-05-05T12:00:00Z' },
]

export const DEMO_SERVICOS: Servico[] = [
  { id: 'demo-serv-manicure', prestadora_id: 'demo-prestadora', nome: 'Manicure completa', preco: 45, duracao_minutos: 60, descricao: 'Cutilagem, esmaltação e hidratação das mãos.', ativo: true, created_at: '2025-01-15T12:00:00Z' },
  { id: 'demo-serv-pedicure', prestadora_id: 'demo-prestadora', nome: 'Pedicure completa', preco: 55, duracao_minutos: 60, descricao: 'Cutilagem, esmaltação e esfoliação dos pés.', ativo: true, created_at: '2025-01-15T12:00:00Z' },
  { id: 'demo-serv-alongamento', prestadora_id: 'demo-prestadora', nome: 'Alongamento em gel', preco: 180, duracao_minutos: 120, descricao: 'Extensão das unhas em gel com formato e comprimento personalizados.', ativo: true, created_at: '2025-01-15T12:00:00Z' },
  { id: 'demo-serv-esmaltacao', prestadora_id: 'demo-prestadora', nome: 'Esmaltação em gel', preco: 70, duracao_minutos: 60, descricao: 'Esmaltação em gel com maior durabilidade e brilho.', ativo: true, created_at: '2025-01-15T12:00:00Z' },
]

const [manicure, pedicure, alongamento, esmaltacao] = DEMO_SERVICOS
const [maria, julia, fernanda, camila, beatriz] = DEMO_CLIENTES
const [ana, carol] = DEMO_PROFISSIONAIS

function montarAgendamento(
  id: string,
  offset: number, hora: number, minuto: number,
  cliente: Cliente, servico: Servico, profissional: Profissional,
  status: Agendamento['status'],
): Agendamento {
  return {
    id,
    prestadora_id: DEMO_PRESTADORA.id,
    profissional_id: profissional.id,
    servico_id: servico.id,
    cliente_id: cliente.id,
    data_hora: em(offset, hora, minuto),
    status,
    cancelado_por: status === 'cancelado' ? 'prestadora' : null,
    arquivado: false,
    created_at: em(offset - 3, 9, 0),
    servicos: servico,
    clientes: cliente,
    profissionais: profissional,
  }
}

export const DEMO_AGENDAMENTOS: Agendamento[] = [
  // Confirmados (6) — hoje e próximos dias
  montarAgendamento('demo-ag-01', 0, 9, 0, maria, manicure, ana, 'confirmado'),
  montarAgendamento('demo-ag-02', 0, 10, 30, julia, esmaltacao, carol, 'confirmado'),
  montarAgendamento('demo-ag-03', 0, 14, 0, fernanda, pedicure, ana, 'confirmado'),
  montarAgendamento('demo-ag-04', 1, 9, 0, camila, alongamento, ana, 'confirmado'),
  montarAgendamento('demo-ag-05', 1, 11, 0, beatriz, manicure, carol, 'confirmado'),
  montarAgendamento('demo-ag-06', 3, 15, 0, maria, esmaltacao, carol, 'confirmado'),
  // Concluídos (4) — dias anteriores
  montarAgendamento('demo-ag-07', -10, 10, 0, julia, manicure, ana, 'concluido'),
  montarAgendamento('demo-ag-08', -7, 13, 0, maria, pedicure, carol, 'concluido'),
  montarAgendamento('demo-ag-09', -5, 11, 0, camila, manicure, ana, 'concluido'),
  montarAgendamento('demo-ag-10', -3, 16, 0, maria, alongamento, ana, 'concluido'),
  // Cancelados (2)
  montarAgendamento('demo-ag-11', -4, 9, 30, julia, esmaltacao, carol, 'cancelado'),
  montarAgendamento('demo-ag-12', -2, 14, 30, fernanda, manicure, ana, 'cancelado'),
]

export const DEMO_HORARIOS_FUNCIONAMENTO: HorarioFuncionamento[] = [
  { id: 'demo-h0', prestadora_id: 'demo-prestadora', dia_semana: 0, ativo: false, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'demo-h1', prestadora_id: 'demo-prestadora', dia_semana: 1, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'demo-h2', prestadora_id: 'demo-prestadora', dia_semana: 2, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'demo-h3', prestadora_id: 'demo-prestadora', dia_semana: 3, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'demo-h4', prestadora_id: 'demo-prestadora', dia_semana: 4, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'demo-h5', prestadora_id: 'demo-prestadora', dia_semana: 5, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00' },
  { id: 'demo-h6', prestadora_id: 'demo-prestadora', dia_semana: 6, ativo: true, hora_abertura: '09:00', hora_fechamento: '13:00' },
]

export const DEMO_AVALIACOES: (Avaliacao & { agendamentos: { clientes: { nome: string } | null; servicos: { nome: string } | null } | null })[] = [
  {
    id: 'demo-av-1', agendamento_id: 'demo-ag-07', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Atendimento incrível, super atenciosa! Minhas unhas ficaram perfeitas.', destaque: true,
    created_at: em(-9, 12, 0),
    agendamentos: { clientes: { nome: 'Júlia Santos' }, servicos: { nome: 'Manicure completa' } },
  },
  {
    id: 'demo-av-2', agendamento_id: 'demo-ag-08', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Profissional excelente, ambiente acolhedor. Recomendo demais!', destaque: true,
    created_at: em(-6, 15, 0),
    agendamentos: { clientes: { nome: 'Maria Silva' }, servicos: { nome: 'Pedicure completa' } },
  },
  {
    id: 'demo-av-3', agendamento_id: 'demo-ag-09', prestadora_id: 'demo-prestadora', nota: 4,
    comentario: 'Muito bom, só achei o horário um pouco apertado.', destaque: false,
    created_at: em(-4, 9, 0),
    agendamentos: { clientes: { nome: 'Camila Oliveira' }, servicos: { nome: 'Manicure completa' } },
  },
]

export const DEMO_VISITAS_PAGINA: { id: string; prestadora_id: string; created_at: string }[] =
  Array.from({ length: 34 }, (_, i) => ({
    id: `demo-visita-${i}`,
    prestadora_id: 'demo-prestadora',
    created_at: em(-Math.floor(i / 2), 8 + (i % 10), 0),
  }))
