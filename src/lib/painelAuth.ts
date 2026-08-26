import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Prestadora } from '@/lib/types'

/**
 * Busca a prestadora autenticada da sessão atual — memoizado por requisição
 * via `cache()` do React. `painel/layout.tsx` e cada `page.tsx` do painel
 * chamavam `getUser()` + `select('*') from prestadoras` de forma
 * independente, uma vez cada, repetindo a mesma consulta a cada navegação
 * (layout + página, sempre as duas). `cache()` faz o React dedupear
 * chamadas com a mesma função dentro de uma única renderização de request —
 * então não importa quantos lugares chamem isso na mesma navegação, só a
 * primeira chamada de fato consulta o banco.
 *
 * Redireciona pro login se não houver sessão (universal — sem sessão não há
 * o que fazer em lugar nenhum do painel). Já a ausência de prestadora fica
 * por conta de quem chama: o layout manda pro cadastro, as páginas mandam
 * pro login — não dá pra decidir isso aqui dentro de um jeito só, então só
 * devolve `prestadora: null` e cada chamador decide.
 */
export const getPrestadoraAutenticada = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/painel/login')

  const { data: prestadora } = await supabase
    .from('prestadoras')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return { supabase, user, prestadora: prestadora as Prestadora | null }
})

export type PrestadoraAutenticada = { supabase: Awaited<ReturnType<typeof createClient>>; user: User; prestadora: Prestadora | null }
