'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notificacao } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface Props {
  prestadoraId: string
}

export function NotificacoesSino({ prestadoraId }: Props) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const naoLidas = notificacoes.filter((n) => !n.lida).length

  /* Carga inicial + realtime via Broadcast */
  useEffect(() => {
    const supabase = createClient()
    let mounted = true
    // Tipagem: ReturnType do método channel do cliente Supabase
    let ch: ReturnType<(typeof supabase)['channel']> | null = null

    // Carga inicial das notificações existentes
    supabase
      .from('notificacoes')
      .select('*')
      .eq('prestadora_id', prestadoraId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data && mounted) setNotificacoes(data)
      })

    // Pega o userId da sessão para montar o topic do broadcast
    // O topic no trigger SQL é 'notificacoes:{user_id}'
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || !session?.user?.id) return
      const userId = session.user.id
      const topic = `notificacoes:${userId}`

      // Necessário para canais privados: autentica o cliente Realtime
      // com o access_token da sessão antes de criar o canal
      supabase.realtime.setAuth(session.access_token)

      console.log('[notif-sino] subscrevendo broadcast topic:', topic)

      ch = supabase
        .channel(topic, { config: { private: true } })
        .on(
          'broadcast',
          { event: 'INSERT' },
          (payload) => {
            // realtime.broadcast_changes() entrega o row em payload.payload.record
            const novaRow = payload.payload?.record as Notificacao | undefined

            if (!novaRow?.id) return

            const nova: Notificacao = {
              ...novaRow,
              lida: false,
              created_at: novaRow.created_at ?? new Date().toISOString(),
            }
            setNotificacoes((prev) => [nova, ...prev])
          },
        )
        .subscribe((status, err) => {
          console.log('[notif-sino] status do canal:', status, '| topic:', topic)
          if (err) console.error('[notif-sino] erro:', status, err)
        })
    })

    return () => {
      mounted = false
      if (ch) supabase.removeChannel(ch)
    }
  }, [prestadoraId])

  /* Fecha ao clicar fora */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  /* Ao abrir o dropdown: marca todas como lidas e zera o badge */
  async function handleToggle() {
    const next = !open
    setOpen(next)
    if (next && naoLidas > 0) {
      setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })))
      const supabase = createClient()
      supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('prestadora_id', prestadoraId)
        .eq('lida', false)
        .then(() => {})
    }
  }

  async function limparTodas() {
    const supabase = createClient()
    await supabase.from('notificacoes').delete().eq('prestadora_id', prestadoraId)
    setNotificacoes([])
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Notificações"
        suppressHydrationWarning
      >
        <Bell className="w-5 h-5" />
        {naoLidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">Notificações</h3>
            {notificacoes.length > 0 && (
              <button
                onClick={limparTodas}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Limpar tudo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notificacoes.length === 0 ? (
              <div className="py-10 text-center text-gray-400 text-sm">
                Nenhuma notificação
              </div>
            ) : (
              notificacoes.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0',
                    !n.lida && 'bg-pink-50/60'
                  )}
                >
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    n.tipo === 'cancelamento' ? 'bg-red-400' : 'bg-rose-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 leading-snug">{n.mensagem}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>


        </div>
      )}
    </div>
  )
}
