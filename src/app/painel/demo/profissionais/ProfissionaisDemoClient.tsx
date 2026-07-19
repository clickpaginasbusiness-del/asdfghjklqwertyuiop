'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Upload, UserCircle2, ToggleLeft, ToggleRight, CalendarDays } from 'lucide-react'
import type { Profissional } from '@/lib/types'
import { demoToast } from '@/lib/demoData'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface ProfForm {
  nome: string
  bio: string
}

interface DispForm {
  usarDiasEstabelecimento: boolean
  dias: number[]
  usarHorarioEstabelecimento: boolean
  hora_abertura: string
  hora_fechamento: string
}

const emptyForm: ProfForm = { nome: '', bio: '' }

export default function ProfissionaisDemoClient({
  profissionais,
}: {
  profissionais: Profissional[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ProfForm>(emptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const [dispModal, setDispModal] = useState(false)
  const [dispProfId, setDispProfId] = useState<string | null>(null)
  const [dispForm, setDispForm] = useState<DispForm>({
    usarDiasEstabelecimento: true,
    dias: [1, 2, 3, 4, 5, 6],
    usarHorarioEstabelecimento: true,
    hora_abertura: '09:00',
    hora_fechamento: '18:00',
  })

  function openCreate() {
    setForm(emptyForm)
    setEditId(null)
    setModalOpen(true)
  }

  function openEdit(p: Profissional) {
    setForm({ nome: p.nome, bio: p.bio ?? '' })
    setEditId(p.id)
    setModalOpen(true)
  }

  function openDisp(p: Profissional) {
    setDispProfId(p.id)
    setDispForm({
      usarDiasEstabelecimento: !p.dias_semana,
      dias: p.dias_semana ?? [1, 2, 3, 4, 5, 6],
      usarHorarioEstabelecimento: !p.hora_abertura,
      hora_abertura: p.hora_abertura ?? '09:00',
      hora_fechamento: p.hora_fechamento ?? '18:00',
    })
    setDispModal(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    demoToast()
    setModalOpen(false)
  }

  function saveDisp() {
    demoToast()
    setDispModal(false)
  }

  function handleDelete() {
    demoToast()
    setDeleteId(null)
  }

  const dispProfNome = profissionais.find((p) => p.id === dispProfId)?.nome ?? ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-gray-900">Profissionais</h1>
          <p className="text-sm text-gray-400 mt-1">As clientes escolherão a profissional ao agendar</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      </div>

      <input type="file" accept="image/*" className="hidden" onChange={demoToast} />

      {profissionais.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <UserCircle2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhuma profissional cadastrada</p>
              <p className="text-xs mt-1 mb-4">Sem profissionais, os agendamentos ficam sem atribuição específica</p>
              <Button onClick={openCreate} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                Adicionar primeira profissional
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profissionais.map((p) => (
            <Card key={p.id} className={`transition-all ${!p.ativa ? 'opacity-60' : 'hover:shadow-md'}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative group shrink-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-rose-100 border-2 border-white shadow">
                      {p.foto_url ? (
                        <Image src={p.foto_url} alt={p.nome} width={64} height={64} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-rose-300 font-bold text-xl font-serif">
                          {p.nome.charAt(0)}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={demoToast}
                      className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <Upload className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{p.nome}</h3>
                      <Badge variant={p.ativa ? 'success' : 'default'} className="shrink-0">
                        {p.ativa ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>
                    {p.bio && <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{p.bio}</p>}
                    {(p.dias_semana || p.hora_abertura) && (
                      <div className="mt-1.5 text-xs text-rose-400 flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {p.dias_semana
                          ? p.dias_semana.map((d) => DIAS_SEMANA[d]).join(' · ')
                          : 'Dias do estabelecimento'}
                        {p.hora_abertura && p.hora_fechamento && (
                          <span className="text-gray-400"> · {p.hora_abertura}–{p.hora_fechamento}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={demoToast}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {p.ativa
                      ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                      : <ToggleLeft className="w-4 h-4 text-gray-400" />
                    }
                    {p.ativa ? 'Desativar' : 'Ativar'}
                  </button>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={() => openDisp(p)}
                      className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Configurar disponibilidade"
                    >
                      <CalendarDays className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(p.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar profissional' : 'Nova profissional'}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Carla"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <Textarea
            label="Bio (opcional)"
            placeholder="Especialidade, tempo de experiência..."
            rows={3}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              {editId ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal disponibilidade */}
      <Modal open={dispModal} onClose={() => setDispModal(false)} title={`Disponibilidade — ${dispProfNome}`}>
        <div className="p-6 space-y-5">
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Dias de trabalho</h4>
            <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={dispForm.usarDiasEstabelecimento}
                onChange={(e) => setDispForm((f) => ({ ...f, usarDiasEstabelecimento: e.target.checked }))}
                className="rounded border-gray-300 text-rose-400 focus:ring-rose-300"
              />
              Seguir os dias do estabelecimento
            </label>

            {!dispForm.usarDiasEstabelecimento && (
              <div className="flex gap-2 flex-wrap">
                {DIAS_SEMANA.map((nome, i) => {
                  const checked = dispForm.dias.includes(i)
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer border transition-all ${
                        checked
                          ? 'bg-rose-400 text-white border-rose-400'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-rose-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setDispForm((f) => ({
                            ...f,
                            dias: e.target.checked
                              ? [...f.dias, i].sort((a, b) => a - b)
                              : f.dias.filter((d) => d !== i),
                          }))
                        }
                        className="hidden"
                      />
                      {nome}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Horário</h4>
            <label className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={dispForm.usarHorarioEstabelecimento}
                onChange={(e) => setDispForm((f) => ({ ...f, usarHorarioEstabelecimento: e.target.checked }))}
                className="rounded border-gray-300 text-rose-400 focus:ring-rose-300"
              />
              Seguir o horário do estabelecimento
            </label>

            {!dispForm.usarHorarioEstabelecimento && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Entrada</label>
                  <input
                    type="time"
                    value={dispForm.hora_abertura}
                    onChange={(e) => setDispForm((f) => ({ ...f, hora_abertura: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Saída</label>
                  <input
                    type="time"
                    value={dispForm.hora_fechamento}
                    onChange={(e) => setDispForm((f) => ({ ...f, hora_fechamento: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setDispModal(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={saveDisp} className="flex-1">
              Salvar disponibilidade
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal confirmar remoção */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover profissional?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Agendamentos existentes não serão afetados. Os futuros ficam sem profissional atribuída.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
