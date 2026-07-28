/**
 * Registra um envio de WhatsApp (lembrete/confirmação) pras missões do mês.
 * Fire-and-forget: nunca bloqueia nem afeta o clique no link do WhatsApp —
 * se a chamada falhar, o envio em si já aconteceu normalmente.
 */
export function logMissaoEvento(tipo: 'lembrete' | 'confirmacao', clienteId: string, agendamentoId?: string) {
  fetch('/api/missoes/evento', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo, clienteId, agendamentoId: agendamentoId ?? null }),
  }).catch(() => {})
}
