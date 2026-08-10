'use client'

import { buildWhatsappUrl } from '@/lib/utils'
import { renderTemplate, MSG_CONFIRMACAO_DEFAULT, MSG_CANCELAMENTO_DEFAULT, MSG_LEMBRETE_DEFAULT } from '@/lib/whatsappTemplates'
import { logMissaoEvento } from '@/lib/missoesClient'

/** Formato mínimo que renderTemplate precisa — mesmo raciocínio estrutural
 * de agendamentoAcoes.ts, pra servir tanto Agendamento (lista) quanto
 * AgendaSlotAg (calendário) sem forçar um tipo só. */
interface AgendamentoParaMensagem {
  id: string
  cliente_id: string
  data_hora: string
  status: string
  clientes?: { nome: string } | null
  servicos?: { nome: string } | null
  profissionais?: { nome: string } | null
}

interface Props {
  agendamento: AgendamentoParaMensagem
  telefone: string
  prestadoraNome: string
  msgConfirmacao: string | null
  msgCancelamento: string | null
  msgLembrete: string | null
  amanha: Date
  onClose: () => void
}

/** As 3 opções de mensagem (confirmação/cancelamento/lembrete) do dropdown
 * de WhatsApp — mesmo conteúdo usado em /painel/agendamentos e
 * /painel/calendario, extraído aqui pra não duplicar os templates. */
export function WhatsappAcoesMenu({
  agendamento: a, telefone, prestadoraNome, msgConfirmacao, msgCancelamento, msgLembrete, amanha, onClose,
}: Props) {
  return (
    <div
      className="absolute left-0 bottom-full mb-1 z-20 bg-white border border-gray-100 rounded-xl shadow-xl p-1.5 space-y-0.5 w-52"
      onClick={(e) => e.stopPropagation()}
    >
      <a
        href={buildWhatsappUrl(telefone, renderTemplate(msgConfirmacao || MSG_CONFIRMACAO_DEFAULT, a, prestadoraNome))}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => { onClose(); logMissaoEvento('confirmacao', a.cliente_id, a.id) }}
        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-green-50 rounded-lg transition-colors"
      >
        ✅ Enviar confirmação
      </a>
      <a
        href={buildWhatsappUrl(telefone, renderTemplate(msgCancelamento || MSG_CANCELAMENTO_DEFAULT, a, prestadoraNome))}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-red-50 rounded-lg transition-colors"
      >
        ❌ Enviar cancelamento
      </a>
      {a.status === 'confirmado' && new Date(a.data_hora) >= amanha && (
        <a
          href={buildWhatsappUrl(telefone, renderTemplate(msgLembrete || MSG_LEMBRETE_DEFAULT, a, prestadoraNome))}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => { onClose(); logMissaoEvento('lembrete', a.cliente_id) }}
          className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-amber-50 rounded-lg transition-colors"
        >
          🔔 Enviar lembrete
        </a>
      )}
    </div>
  )
}
