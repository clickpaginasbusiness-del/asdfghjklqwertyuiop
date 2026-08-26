import { addDays, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns'
import toast from 'react-hot-toast'
import type {
  Prestadora, Profissional, Cliente, Servico, Agendamento, HorarioFuncionamento, Avaliacao,
  CaixaPrestadora, CaixaSaque,
} from '@/lib/types'
import type { LancamentoFinanceiro } from '@/app/painel/relatorios/RelatoriosClient'

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
  mp_customer_id: null,
  mp_subscription_id: 'demo_sub',
  mp_metodo_pagamento: 'cartao',
  mp_ciclo: 'mensal',
  mp_periodo_fim: null,
  mp_pagamento_pendente_id: null,
  cancelamento_agendado: false,
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
  indicacao_cadastro_processada: false,
  last_seen_at: null,
  e_parceira: false,
  parceira_desde: null,
  parceira_comissao_percentual: 20,
  parceira_periodo_30_inicio: null,
  parceira_pix: null,
  pagina_texto_agendamento: 'Agendamento online 24h',
  pagina_mostrar_texto_agendamento: true,
  pagina_mostrar_estrelas: true,
  pagina_mostrar_avaliacoes: true,
  pagina_mostrar_galeria: true,
  pagina_galeria_modo: 'empilhada',
  pagina_galeria_fotos_ids: [],
  pagina_mostrar_estabelecimento: false,
  pagina_estabelecimento_modo: 'empilhada',
  pagina_estabelecimento_fotos_ids: [],
  pagina_estabelecimento_titulo: 'Nosso espaço',
  pagina_preset: 'classico',
  pagina_banner_foto_id: null,
  link_compartilhado_em: null,
  checklist_completo: true,
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
    intervalo_inicio: null,
    intervalo_fim: null,
    comissao_percentual: 40,
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
    intervalo_inicio: null,
    intervalo_fim: null,
    comissao_percentual: 35,
    created_at: '2025-02-01T12:00:00Z',
  },
]

export const DEMO_CLIENTES: Cliente[] = [
  { id: 'demo-cli-maria', nome: 'Maria Silva', telefone: '31999991111', cliente_manual: false, verificado_em: '2025-03-01T12:00:00Z', data_nascimento: '1995-08-15', notas: 'Prefere esmalte fosco. Alérgica a acetona.', created_at: '2025-03-01T12:00:00Z' },
  { id: 'demo-cli-julia', nome: 'Júlia Santos', telefone: '31999992222', cliente_manual: false, verificado_em: '2025-03-10T12:00:00Z', data_nascimento: '1998-11-02', notas: null, created_at: '2025-03-10T12:00:00Z' },
  { id: 'demo-cli-fernanda', nome: 'Fernanda Costa', telefone: '31999993333', cliente_manual: false, verificado_em: '2025-04-02T12:00:00Z', data_nascimento: null, notas: 'Gosta de conversar sobre viagens durante o atendimento.', created_at: '2025-04-02T12:00:00Z' },
  { id: 'demo-cli-camila', nome: 'Camila Oliveira', telefone: '31999994444', cliente_manual: false, verificado_em: '2025-04-20T12:00:00Z', data_nascimento: '1990-01-22', notas: null, created_at: '2025-04-20T12:00:00Z' },
  { id: 'demo-cli-beatriz', nome: 'Beatriz Lima', telefone: '31999995555', cliente_manual: false, verificado_em: '2025-05-05T12:00:00Z', data_nascimento: null, notas: null, created_at: '2025-05-05T12:00:00Z' },
]

const SEM_PAGAMENTO_ONLINE = { aceitar_pagamento_online: false, sinal_tipo: null, sinal_valor: null, sinal_obrigatorio: false } as const

export const DEMO_SERVICOS: Servico[] = [
  { id: 'demo-serv-manicure', prestadora_id: 'demo-prestadora', nome: 'Manicure completa', preco: 45, duracao_minutos: 60, descricao: 'Cutilagem, esmaltação e hidratação das mãos.', ativo: true, icone: 'Hand', foto_galeria_id: null, ...SEM_PAGAMENTO_ONLINE, created_at: '2025-01-15T12:00:00Z' },
  { id: 'demo-serv-pedicure', prestadora_id: 'demo-prestadora', nome: 'Pedicure completa', preco: 55, duracao_minutos: 60, descricao: 'Cutilagem, esmaltação e esfoliação dos pés.', ativo: true, icone: 'Droplets', foto_galeria_id: null, ...SEM_PAGAMENTO_ONLINE, created_at: '2025-01-15T12:00:00Z' },
  { id: 'demo-serv-alongamento', prestadora_id: 'demo-prestadora', nome: 'Alongamento em gel', preco: 180, duracao_minutos: 120, descricao: 'Extensão das unhas em gel com formato e comprimento personalizados.', ativo: true, icone: 'Gem', foto_galeria_id: null, ...SEM_PAGAMENTO_ONLINE, created_at: '2025-01-15T12:00:00Z' },
  { id: 'demo-serv-esmaltacao', prestadora_id: 'demo-prestadora', nome: 'Esmaltação em gel', preco: 70, duracao_minutos: 60, descricao: 'Esmaltação em gel com maior durabilidade e brilho.', ativo: true, icone: 'Sparkles', foto_galeria_id: null, ...SEM_PAGAMENTO_ONLINE, created_at: '2025-01-15T12:00:00Z' },
]

const [manicure, pedicure, alongamento, esmaltacao] = DEMO_SERVICOS
const [maria, julia, fernanda, camila, beatriz] = DEMO_CLIENTES
const [ana, carol] = DEMO_PROFISSIONAIS

// Data relativa a `agora` (recebido pelo chamador) em vez de `new Date()` no
// escopo do módulo — que só seria recalculado no cold start da function
// serverless, não a cada request, fazendo os agendamentos "de hoje" ficarem
// presos num dia antigo assim que a instância esquenta por muito tempo.
function dataRelativa(agora: Date, diasOffset: number, hora: number, minuto: number): string {
  const base = setSeconds(setMinutes(setHours(startOfDay(addDays(agora, diasOffset)), hora), minuto), 0)
  return base.toISOString()
}

function diaDaSemana(agora: Date, offset: number): number {
  return addDays(agora, offset).getDay()
}

function montarAgendamento(
  agora: Date,
  id: string,
  offset: number, hora: number, minuto: number,
  cliente: Cliente, servico: Servico, profissional: Profissional,
  status: Agendamento['status'],
  opcoes: { manual?: boolean; voce?: boolean } = {},
): Agendamento {
  return {
    id,
    prestadora_id: DEMO_PRESTADORA.id,
    profissional_id: profissional.id,
    servico_id: servico.id,
    cliente_id: cliente.id,
    data_hora: dataRelativa(agora, offset, hora, minuto),
    status,
    cancelado_por: status === 'cancelado' ? 'prestadora' : null,
    arquivado: false,
    cliente_e_prestadora: opcoes.voce ?? false,
    agendamento_manual: opcoes.manual ?? false,
    created_at: dataRelativa(agora, offset - 3, 9, 0),
    servicos: servico,
    clientes: cliente,
    profissionais: profissional,
  }
}

// Recebe `agora` de quem chama (Server Component, avaliado a cada request)
// em vez de fixar a data internamente — servidor e cliente calculam a partir
// do mesmo valor, então não há mismatch de hidratação.
//
// Agenda "cheia" de salão de sucesso: 96 atendimentos concluídos nos últimos
// dias úteis (24 dias × manicure+pedicure+esmaltação+alongamento =
// R$350/dia = R$8.400 no mês, batendo com o card de faturamento dos
// relatórios) + 6 confirmados (hoje/próximos dias) + 12 cancelados
// espalhados (deixando alguns dias com 5-6 agendamentos no total).
export function getDemoAgendamentos(agora: Date): Agendamento[] {
  const resultado: Agendamento[] = []
  let n = 1
  function novoId(): string { return `demo-ag-${String(n++).padStart(3, '0')}` }
  function add(
    offset: number, hora: number, minuto: number,
    cliente: Cliente, servico: Servico, profissional: Profissional,
    status: Agendamento['status'], opcoes?: { manual?: boolean; voce?: boolean },
  ) {
    resultado.push(montarAgendamento(agora, novoId(), offset, hora, minuto, cliente, servico, profissional, status, opcoes))
  }

  // Confirmados — hoje e próximos dias (agenda de hoje / próximos agendamentos)
  add(0, 9, 0, maria, manicure, ana, 'confirmado')
  add(0, 10, 30, julia, esmaltacao, carol, 'confirmado')
  add(0, 14, 0, fernanda, pedicure, ana, 'confirmado')
  add(1, 9, 0, camila, alongamento, ana, 'confirmado')
  add(1, 11, 0, beatriz, manicure, carol, 'confirmado')
  add(3, 15, 0, maria, esmaltacao, carol, 'confirmado')

  // Concluídos — 24 dias úteis, 4 atendimentos/dia (R$350/dia = R$8.400/mês)
  const clientesCiclo = [maria, julia, fernanda, camila, beatriz]
  const profissionaisCiclo = [ana, carol]
  const servicosCiclo = [manicure, pedicure, esmaltacao, alongamento]
  const horariosDia: [number, number][] = [[9, 0], [10, 30], [13, 0], [15, 30]]

  let offset = -1
  for (let ciclo = 0; ciclo < 24; ciclo++) {
    while (diaDaSemana(agora, offset) === 0) offset-- // pula domingo
    for (let s = 0; s < servicosCiclo.length; s++) {
      const i = ciclo * servicosCiclo.length + s
      const [hora, minuto] = horariosDia[s]
      add(
        offset, hora, minuto,
        clientesCiclo[i % clientesCiclo.length], servicosCiclo[s], profissionaisCiclo[i % profissionaisCiclo.length],
        'concluido',
        { manual: i === 12 || i === 40 || i === 70, voce: i === 55 },
      )
    }
    offset--
  }

  // Cancelados — 12, espalhados pelos mesmos dias (alguns dias chegam a 5-6
  // agendamentos no total, contando confirmado+concluído+cancelado).
  for (let i = 0; i < 12; i++) {
    const diaOffset = -1 - i * 2
    add(diaOffset, 11, 0, clientesCiclo[i % clientesCiclo.length], servicosCiclo[i % servicosCiclo.length], profissionaisCiclo[i % 2], 'cancelado')
  }

  return resultado
}

export const DEMO_HORARIOS_FUNCIONAMENTO: HorarioFuncionamento[] = [
  { id: 'demo-h0', prestadora_id: 'demo-prestadora', dia_semana: 0, ativo: false, hora_abertura: '09:00', hora_fechamento: '18:00', turno2_inicio: null, turno2_fim: null },
  { id: 'demo-h1', prestadora_id: 'demo-prestadora', dia_semana: 1, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00', turno2_inicio: null, turno2_fim: null },
  { id: 'demo-h2', prestadora_id: 'demo-prestadora', dia_semana: 2, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00', turno2_inicio: null, turno2_fim: null },
  { id: 'demo-h3', prestadora_id: 'demo-prestadora', dia_semana: 3, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00', turno2_inicio: null, turno2_fim: null },
  { id: 'demo-h4', prestadora_id: 'demo-prestadora', dia_semana: 4, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00', turno2_inicio: null, turno2_fim: null },
  { id: 'demo-h5', prestadora_id: 'demo-prestadora', dia_semana: 5, ativo: true, hora_abertura: '09:00', hora_fechamento: '18:00', turno2_inicio: null, turno2_fim: null },
  { id: 'demo-h6', prestadora_id: 'demo-prestadora', dia_semana: 6, ativo: true, hora_abertura: '09:00', hora_fechamento: '13:00', turno2_inicio: null, turno2_fim: null },
]

export const DEMO_AVALIACOES: (Avaliacao & { agendamentos: { clientes: { nome: string } | null; servicos: { nome: string } | null } | null })[] = [
  {
    id: 'demo-av-1', agendamento_id: 'demo-ag-005', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Atendimento incrível, super atenciosa! Minhas unhas ficaram perfeitas.', destaque: true,
    created_at: em(-9, 12, 0),
    agendamentos: { clientes: { nome: 'Júlia Santos' }, servicos: { nome: 'Manicure completa' } },
  },
  {
    id: 'demo-av-2', agendamento_id: 'demo-ag-009', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Profissional excelente, ambiente acolhedor. Recomendo demais!', destaque: true,
    created_at: em(-8, 15, 0),
    agendamentos: { clientes: { nome: 'Maria Silva' }, servicos: { nome: 'Pedicure completa' } },
  },
  {
    id: 'demo-av-3', agendamento_id: 'demo-ag-013', prestadora_id: 'demo-prestadora', nota: 4,
    comentario: 'Muito bom, só achei o horário um pouco apertado.', destaque: false,
    created_at: em(-7, 9, 0),
    agendamentos: { clientes: { nome: 'Camila Oliveira' }, servicos: { nome: 'Manicure completa' } },
  },
  {
    id: 'demo-av-4', agendamento_id: 'demo-ag-017', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Melhor alongamento que já fiz, ficou super natural!', destaque: true,
    created_at: em(-6, 16, 0),
    agendamentos: { clientes: { nome: 'Beatriz Lima' }, servicos: { nome: 'Alongamento em gel' } },
  },
  {
    id: 'demo-av-5', agendamento_id: 'demo-ag-021', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Sempre saio satisfeita, virei cliente fiel!', destaque: false,
    created_at: em(-5, 10, 0),
    agendamentos: { clientes: { nome: 'Fernanda Costa' }, servicos: { nome: 'Esmaltação em gel' } },
  },
  {
    id: 'demo-av-6', agendamento_id: 'demo-ag-025', prestadora_id: 'demo-prestadora', nota: 4,
    comentario: 'Gostei bastante, voltarei com certeza.', destaque: false,
    created_at: em(-4, 14, 0),
    agendamentos: { clientes: { nome: 'Maria Silva' }, servicos: { nome: 'Manicure completa' } },
  },
  {
    id: 'demo-av-7', agendamento_id: 'demo-ag-029', prestadora_id: 'demo-prestadora', nota: 5,
    comentario: 'Trabalho impecável, atenção incrível aos detalhes!', destaque: false,
    created_at: em(-3, 11, 0),
    agendamentos: { clientes: { nome: 'Júlia Santos' }, servicos: { nome: 'Pedicure completa' } },
  },
]

export const DEMO_VISITAS_PAGINA: { id: string; prestadora_id: string; created_at: string }[] =
  Array.from({ length: 34 }, (_, i) => ({
    id: `demo-visita-${i}`,
    prestadora_id: 'demo-prestadora',
    created_at: em(-Math.floor(i / 2), 8 + (i % 10), 0),
  }))

// ── Financeiro (aba Financeiro em /painel/demo/relatorios) ────────────────
// Despesas somam -R$3.200 — com o faturamento de ~R$8.400 acima (só
// concluídos), fecha um lucro de ~R$5.200/mês, como um salão saudável.
export function getDemoLancamentos(agora: Date): LancamentoFinanceiro[] {
  const dataStr = (offset: number) => dataRelativa(agora, offset, 12, 0).slice(0, 10)
  return [
    { id: 'demo-lanc-1', descricao: 'Aluguel do salão', valor: -1200, categoria: 'Aluguel', data: dataStr(-20), created_at: dataRelativa(agora, -20, 12, 0) },
    { id: 'demo-lanc-2', descricao: 'Esmaltes e materiais', valor: -800, categoria: 'Material', data: dataStr(-15), created_at: dataRelativa(agora, -15, 12, 0) },
    { id: 'demo-lanc-3', descricao: 'Lima elétrica nova', valor: -600, categoria: 'Equipamento', data: dataStr(-10), created_at: dataRelativa(agora, -10, 12, 0) },
    { id: 'demo-lanc-4', descricao: 'Internet e energia', valor: -600, categoria: 'Outro', data: dataStr(-5), created_at: dataRelativa(agora, -5, 12, 0) },
  ]
}

// ── Caixa (sinal/pagamento pelo app — /painel/demo/caixa) ─────────────────
export function getDemoCaixaResumo(agora: Date): {
  disponivelParaSaque: number
  pendente: number
  totalRecebidoHistorico: number
  historico: (CaixaPrestadora & { servicoNome: string | null })[]
  historicoSaques: CaixaSaque[]
} {
  const dataH = (offset: number) => dataRelativa(agora, offset, 10, 0)
  const historico: (CaixaPrestadora & { servicoNome: string | null })[] = [
    { id: 'demo-caixa-1', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 41.85, valor_bruto: 45, taxa_percentual: 7, status: 'disponivel', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(-13), created_at: dataH(-20), servicoNome: 'Manicure completa' },
    { id: 'demo-caixa-2', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 65.10, valor_bruto: 70, taxa_percentual: 7, status: 'disponivel', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(-11), created_at: dataH(-18), servicoNome: 'Esmaltação em gel' },
    { id: 'demo-caixa-3', prestadora_id: 'demo-prestadora', tipo: 'pagamento_servico', valor: 167.40, valor_bruto: 180, taxa_percentual: 7, status: 'disponivel', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(-9), created_at: dataH(-16), servicoNome: 'Alongamento em gel' },
    { id: 'demo-caixa-4', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 51.15, valor_bruto: 55, taxa_percentual: 7, status: 'disponivel', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(-8), created_at: dataH(-15), servicoNome: 'Pedicure completa' },
    { id: 'demo-caixa-5', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 41.85, valor_bruto: 45, taxa_percentual: 7, status: 'pendente', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(4), created_at: dataH(-3), servicoNome: 'Manicure completa' },
    { id: 'demo-caixa-6', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 65.10, valor_bruto: 70, taxa_percentual: 7, status: 'pendente', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(5), created_at: dataH(-2), servicoNome: 'Esmaltação em gel' },
    { id: 'demo-caixa-7', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 51.15, valor_bruto: 55, taxa_percentual: 7, status: 'pendente', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(6), created_at: dataH(-1), servicoNome: 'Pedicure completa' },
    { id: 'demo-caixa-8', prestadora_id: 'demo-prestadora', tipo: 'sinal', valor: 234, valor_bruto: 251.61, taxa_percentual: 7, status: 'sacado', agendamento_id: null, mp_payment_id: null, disponivel_em: dataH(-25), created_at: dataH(-30), servicoNome: 'Alongamento em gel' },
  ]
  const historicoSaques: CaixaSaque[] = [
    { id: 'demo-saque-1', prestadora_id: 'demo-prestadora', valor: 234, pix_chave: 'ana.nails@pix.com', status: 'pago', solicitado_em: dataH(-28), pago_em: dataH(-27), created_at: dataH(-28) },
  ]
  const disponivelParaSaque = historico.filter((h) => h.status === 'disponivel').reduce((s, h) => s + h.valor, 0)
  const pendente = historico.filter((h) => h.status === 'pendente').reduce((s, h) => s + h.valor, 0)
  const totalRecebidoHistorico = historico.filter((h) => h.status !== 'reembolsado').reduce((s, h) => s + h.valor, 0)
  return { disponivelParaSaque, pendente, totalRecebidoHistorico, historico, historicoSaques }
}
