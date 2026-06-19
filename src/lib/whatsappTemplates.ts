import { formatDate, formatTime } from './utils'

export const TEMPLATE_VARS: { key: string; label: string }[] = [
  { key: 'cliente_nome', label: 'Nome da cliente' },
  { key: 'servico', label: 'Serviço' },
  { key: 'profissional', label: 'Profissional' },
  { key: 'data', label: 'Data' },
  { key: 'hora', label: 'Hora' },
]

export const MSG_CONFIRMACAO_DEFAULT =
  'Olá {cliente_nome}! Confirmando seu agendamento de {servico} no dia {data} às {hora}. Te esperamos! 💅 - {nome_da_prestadora}'
export const MSG_CANCELAMENTO_DEFAULT =
  'Olá {cliente_nome}, infelizmente precisamos cancelar seu agendamento de {servico} no dia {data}. Entre em contato para remarcar. - {nome_da_prestadora}'
export const MSG_LEMBRETE_DEFAULT =
  'Olá {cliente_nome}! Passando para lembrar do seu agendamento de {servico} amanhã às {hora}. Te esperamos! 💅 - {nome_da_prestadora}'

type AgendamentoLike = {
  data_hora: string
  servicos?: { nome: string } | null
  clientes?: { nome: string } | null
  profissionais?: { nome: string } | null
}

export function renderTemplate(template: string, a: AgendamentoLike, prestadoraNome: string): string {
  const vars: Record<string, string> = {
    cliente_nome: a.clientes?.nome ?? '',
    servico: a.servicos?.nome ?? '',
    profissional: a.profissionais?.nome ?? '',
    data: formatDate(a.data_hora),
    hora: formatTime(a.data_hora),
    nome_da_prestadora: prestadoraNome,
  }
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match)
}
