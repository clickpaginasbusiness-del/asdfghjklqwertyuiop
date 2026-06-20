'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, CalendarX, Plus, Trash2 } from 'lucide-react'
import type { Prestadora, DiaBloqueado, HorarioFuncionamento } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { AgendaDoDiaSection } from './AgendaDoDiaSection'
import type { AgendaSlotAg } from './page'
import toast from 'react-hot-toast'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

interface HorarioDia {
  dia_semana: number
  ativo: boolean
  hora_abertura: string
  hora_fechamento: string
}

const DEFAULTS: HorarioDia[] = DIAS.map((_, i) => ({
  dia_semana: i,
  ativo: i !== 0,
  hora_abertura: '09:00',
  hora_fechamento: i === 6 ? '13:00' : '18:00',
}))

function initHorarios(loaded: HorarioFuncionamento[]): HorarioDia[] {
  return DEFAULTS.map((def) => {
    const found = loaded.find((h) => h.dia_semana === def.dia_semana)
    return found
      ? { dia_semana: found.dia_semana, ativo: found.ativo, hora_abertura: found.hora_abertura, hora_fechamento: found.hora_fechamento }
      : def
  })
}

export default function HorariosClient({
  prestadora,
  diasBloqueados: initial,
  horariosFuncionamento,
  profissionais,
  agendamentos,
}: {
  prestadora: Prestadora
  diasBloqueados: DiaBloqueado[]
  horariosFuncionamento: HorarioFuncionamento[]
  profissionais: { id: string; nome: string }[]
  agendamentos: AgendaSlotAg[]
}) {
  const [horarios, setHorarios] = useState<HorarioDia[]>(() => initHorarios(horariosFuncionamento))
  const [savingHorario, setSavingHorario] = useState(false)

  const [diasBloqueados, setDiasBloqueados] = useState(initial)
  const [novoDia, setNovoDia] = useState('')
  const [addingDia, setAddingDia] = useState(false)

  function toggleDia(index: number) {
    setHorarios((prev) => prev.map((h, i) => i === index ? { ...h, ativo: !h.ativo } : h))
  }

  function updateHora(index: number, field: 'hora_abertura' | 'hora_fechamento', value: string) {
    setHorarios((prev) => prev.map((h, i) => i === index ? { ...h, [field]: value } : h))
  }

  async function salvarHorarios() {
    setSavingHorario(true)
    const supabase = createClient()
    const upserts = horarios.map((h) => ({
      prestadora_id: prestadora.id,
      dia_semana: h.dia_semana,
      ativo: h.ativo,
      hora_abertura: h.hora_abertura,
      hora_fechamento: h.hora_fechamento,
    }))
    const { error } = await supabase
      .from('horarios_funcionamento')
      .upsert(upserts, { onConflict: 'prestadora_id,dia_semana' })

    if (error) toast.error('Erro ao salvar')
    else toast.success('Horários salvos!')
    setSavingHorario(false)
  }

  async function adicionarDia() {
    if (!novoDia) return
    setAddingDia(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('dias_bloqueados')
      .insert({ prestadora_id: prestadora.id, data: novoDia })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') toast.error('Dia já bloqueado')
      else toast.error('Erro ao bloquear dia')
    } else {
      setDiasBloqueados((prev) => [...prev, data].sort((a, b) => a.data.localeCompare(b.data)))
      setNovoDia('')
      toast.success('Dia bloqueado')
    }
    setAddingDia(false)
  }

  async function removerDia(id: string) {
    const supabase = createClient()
    await supabase.from('dias_bloqueados').delete().eq('id', id)
    setDiasBloqueados((prev) => prev.filter((d) => d.id !== id))
    toast.success('Desbloqueado')
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Horários</h1>

      <div className="max-w-2xl space-y-6">
      {/* Horário de funcionamento por dia */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-rose-400" />
            <CardTitle>Horário de funcionamento</CardTitle>
          </div>
          <p className="text-sm text-gray-400">Configure o horário de cada dia da semana</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {horarios.map((h, i) => (
            <div key={h.dia_semana} className="flex flex-wrap items-center gap-3 py-1">
              <div className="flex items-center gap-3 shrink-0">
                {/* Toggle */}
                <button
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={`shrink-0 relative inline-flex h-5 w-9 rounded-full transition-colors focus:outline-none ${
                    h.ativo ? 'bg-rose-400' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                      h.ativo ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </button>

                {/* Nome do dia */}
                <span className={`w-16 text-sm font-medium shrink-0 ${h.ativo ? 'text-gray-700' : 'text-gray-400'}`}>
                  {DIAS[h.dia_semana]}
                </span>
              </div>

              {/* Horários */}
              <div className={`flex items-center gap-2 flex-wrap transition-opacity ${h.ativo ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                <input
                  type="time"
                  value={h.hora_abertura}
                  onChange={(e) => updateHora(i, 'hora_abertura', e.target.value)}
                  disabled={!h.ativo}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-[6.5rem] focus:outline-none focus:ring-1 focus:ring-rose-300 focus:border-rose-300"
                />
                <span className="text-gray-400 text-xs shrink-0">até</span>
                <input
                  type="time"
                  value={h.hora_fechamento}
                  onChange={(e) => updateHora(i, 'hora_fechamento', e.target.value)}
                  disabled={!h.ativo}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-[6.5rem] focus:outline-none focus:ring-1 focus:ring-rose-300 focus:border-rose-300"
                />
              </div>
            </div>
          ))}

          <div className="pt-2">
            <Button onClick={salvarHorarios} loading={savingHorario}>
              Salvar horários
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dias bloqueados */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarX className="w-5 h-5 text-rose-400" />
            <CardTitle>Dias bloqueados</CardTitle>
          </div>
          <p className="text-sm text-gray-500">Feriados, folgas e férias</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              type="date"
              value={novoDia}
              onChange={(e) => setNovoDia(e.target.value)}
              className="flex-1"
            />
            <Button onClick={adicionarDia} loading={addingDia} variant="outline">
              <Plus className="w-4 h-4" />
              Bloquear
            </Button>
          </div>

          {diasBloqueados.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nenhum dia bloqueado</p>
          ) : (
            <div className="space-y-2">
              {diasBloqueados.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm font-medium text-gray-700">{formatDate(d.data)}</span>
                  <button
                    onClick={() => removerDia(d.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Agenda do dia */}
      <AgendaDoDiaSection
        prestadora={prestadora}
        horariosFuncionamento={horariosFuncionamento}
        profissionais={profissionais}
        agendamentos={agendamentos}
      />
    </div>
  )
}
