'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Switch } from '@/components/ui/switch'
import { ImageWithSkeleton } from '@/components/ui/image-with-skeleton'
import { formatCurrency, cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Clock, Scissors, ImageIcon, Check, CreditCard, Lock } from 'lucide-react'
import { SERVICO_ICONE_OPTIONS, SERVICO_ICONE_PADRAO, getServicoIcone, type ServicoIcone } from '@/lib/servicoIcones'
import type { Servico, GaleriaItem } from '@/lib/types'
import PlanosPrestadoraClient, { type PlanoComRelacoes } from './PlanosPrestadoraClient'
import toast from 'react-hot-toast'

interface ServicoForm {
  nome: string
  preco: string
  duracao_minutos: string
  descricao: string
  icone: ServicoIcone
  fotoGaleriaId: string | null
  aceitarPagamentoOnline: boolean
  sinalObrigatorio: boolean
  sinalTipo: 'fixo' | 'percentual'
  sinalValor: string
}

export type ServicoComProfissionais = Servico & {
  servico_profissionais: { profissional_id: string }[]
}

interface ProfissionalLite {
  id: string
  nome: string
}

const emptyForm: ServicoForm = {
  nome: '', preco: '', duracao_minutos: '', descricao: '', icone: SERVICO_ICONE_PADRAO, fotoGaleriaId: null,
  aceitarPagamentoOnline: false, sinalObrigatorio: false, sinalTipo: 'percentual', sinalValor: '',
}

function ToggleComSubtexto({
  label, subtexto, checked, onChange, disabled,
}: {
  label: string
  subtexto: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', disabled ? 'text-gray-400' : 'text-gray-700')}>{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{subtexto}</p>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  )
}

function SeletorFotoIcone({
  galeria,
  selecionada,
  onSelect,
}: {
  galeria: GaleriaItem[]
  selecionada: string | null
  onSelect: (id: string) => void
}) {
  const fotos = galeria.filter((g) => g.tipo === 'imagem')

  if (fotos.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl">
        <ImageIcon className="w-5 h-5 mx-auto mb-1.5 opacity-30" />
        <p className="text-xs">
          Nenhuma foto na galeria.{' '}
          <Link href="/painel/galeria" className="text-rose-500 font-medium underline underline-offset-2">
            Adicionar fotos
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-6 gap-2">
      {fotos.map((item) => {
        const selecionado = item.id === selecionada
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            title="Usar esta foto"
            className={cn(
              'relative aspect-square rounded-lg overflow-hidden ring-2 transition-all',
              selecionado ? 'ring-rose-400' : 'ring-transparent hover:ring-rose-200'
            )}
          >
            <ImageWithSkeleton src={item.url} alt="Foto da galeria" fill className="object-cover" />
            {selecionado && (
              <span className="absolute inset-0 bg-rose-400/25 flex items-center justify-center">
                <Check className="w-5 h-5 text-white drop-shadow" />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function ServicosClient({
  servicos: initial,
  profissionais,
  galeria,
  prestadoraId,
  planosIniciais,
  podeUsarPlanos,
}: {
  servicos: ServicoComProfissionais[]
  profissionais: ProfissionalLite[]
  galeria: GaleriaItem[]
  prestadoraId: string
  planosIniciais: PlanoComRelacoes[]
  podeUsarPlanos: boolean
}) {
  const [aba, setAba] = useState<'servicos' | 'planos'>('servicos')
  const [servicos, setServicos] = useState(initial)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<ServicoForm>(emptyForm)
  const [mostrarSeletorFoto, setMostrarSeletorFoto] = useState(false)
  const [profissionaisSelecionadas, setProfissionaisSelecionadas] = useState<string[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function fotoUrlFor(fotoId: string | null | undefined): string | null {
    if (!fotoId) return null
    return galeria.find((g) => g.id === fotoId)?.url ?? null
  }

  function toggleProfissional(id: string) {
    setProfissionaisSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  function openCreate() {
    setForm(emptyForm)
    setProfissionaisSelecionadas([])
    setEditId(null)
    setMostrarSeletorFoto(false)
    setModalOpen(true)
  }

  function openEdit(s: ServicoComProfissionais) {
    setForm({
      nome: s.nome,
      preco: String(s.preco),
      duracao_minutos: String(s.duracao_minutos),
      descricao: s.descricao ?? '',
      icone: (s.icone as ServicoIcone) ?? SERVICO_ICONE_PADRAO,
      fotoGaleriaId: s.foto_galeria_id,
      aceitarPagamentoOnline: s.aceitar_pagamento_online,
      sinalObrigatorio: s.sinal_obrigatorio,
      sinalTipo: s.sinal_tipo ?? 'percentual',
      sinalValor: s.sinal_valor != null ? String(s.sinal_valor) : '',
    })
    setProfissionaisSelecionadas(s.servico_profissionais.map((sp) => sp.profissional_id))
    setEditId(s.id)
    setMostrarSeletorFoto(!!s.foto_galeria_id)
    setModalOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const sinalAtivo = form.aceitarPagamentoOnline && form.sinalObrigatorio
    if (sinalAtivo) {
      const valor = parseFloat(form.sinalValor)
      if (!Number.isFinite(valor) || valor <= 0) {
        toast.error('Informe um valor de sinal válido')
        return
      }
      if (form.sinalTipo === 'percentual' && valor > 100) {
        toast.error('O percentual do sinal não pode passar de 100%')
        return
      }
    }

    setLoading(true)
    const supabase = createClient()
    const data = {
      prestadora_id: prestadoraId,
      nome: form.nome,
      preco: parseFloat(form.preco),
      duracao_minutos: parseInt(form.duracao_minutos),
      descricao: form.descricao || null,
      icone: form.icone,
      foto_galeria_id: form.fotoGaleriaId,
      aceitar_pagamento_online: form.aceitarPagamentoOnline,
      sinal_obrigatorio: sinalAtivo,
      sinal_tipo: sinalAtivo ? form.sinalTipo : null,
      sinal_valor: sinalAtivo ? parseFloat(form.sinalValor) : null,
    }

    let servicoId = editId

    if (editId) {
      const { error } = await supabase.from('servicos').update(data).eq('id', editId)
      if (error) { toast.error('Erro ao atualizar'); setLoading(false); return }
    } else {
      const { data: novo, error } = await supabase.from('servicos').insert(data).select().single()
      if (error) { toast.error('Erro ao criar'); setLoading(false); return }
      servicoId = novo.id
    }

    // Sincroniza profissionais do serviço: remove tudo e reinsere a seleção atual
    await supabase.from('servico_profissionais').delete().eq('servico_id', servicoId!)
    if (profissionaisSelecionadas.length > 0) {
      await supabase.from('servico_profissionais').insert(
        profissionaisSelecionadas.map((profissional_id) => ({ servico_id: servicoId, profissional_id }))
      )
    }

    const servico_profissionais = profissionaisSelecionadas.map((profissional_id) => ({ profissional_id }))

    if (editId) {
      setServicos((prev) => prev.map((s) => s.id === editId ? { ...s, ...data, servico_profissionais } : s))
      toast.success('Serviço atualizado')
    } else {
      setServicos((prev) => [...prev, { ...data, id: servicoId!, ativo: true, created_at: new Date().toISOString(), servico_profissionais }])
      toast.success('Serviço criado')
    }

    setLoading(false)
    setModalOpen(false)
  }

  async function handleDelete(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('servicos').delete().eq('id', id)
    if (error) { toast.error('Erro ao remover'); return }
    setServicos((prev) => prev.filter((s) => s.id !== id))
    toast.success('Serviço removido')
    setDeleteId(null)
  }

  const usandoFoto = form.fotoGaleriaId !== null
  const fotoAtualUrl = fotoUrlFor(form.fotoGaleriaId)

  return (
    <div className="space-y-6">
      <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50">
        {(['servicos', 'planos'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setAba(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              aba === t ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'servicos' ? 'Serviços' : 'Planos'}
          </button>
        ))}
      </div>

      {aba === 'planos' ? (
        podeUsarPlanos ? (
          <PlanosPrestadoraClient planos={planosIniciais} servicosDisponiveis={servicos} />
        ) : (
          <Card>
            <CardContent>
              <div className="flex flex-col items-center text-center gap-2 py-14 px-6">
                <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center mb-1">
                  <Lock className="w-5 h-5 text-gray-400" />
                </div>
                <p className="font-semibold text-gray-900">Planos de assinatura pra clientes</p>
                <p className="text-sm text-gray-500 max-w-sm">
                  Disponível a partir do Plano Studio. Crie planos recorrentes com crédito de serviços pras suas clientes assinarem direto na sua página.
                </p>
                <Link href="/painel/assinatura" className="mt-2 text-sm font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2">
                  Fazer upgrade
                </Link>
              </div>
            </CardContent>
          </Card>
        )
      ) : (
      <>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Serviços</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="w-4 h-4" />
          Novo serviço
        </Button>
      </div>

      {servicos.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <Scissors className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum serviço cadastrado</p>
              <Button onClick={openCreate} variant="outline" size="sm" className="mt-4">
                Adicionar primeiro serviço
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {servicos.map((s) => {
            const IconeServico = getServicoIcone(s.icone)
            const fotoUrl = fotoUrlFor(s.foto_galeria_id)
            return (
            <Card key={s.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {fotoUrl ? (
                        <ImageWithSkeleton src={fotoUrl} alt={s.nome} fill className="object-cover" />
                      ) : (
                        <IconeServico className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{s.nome}</h3>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {s.descricao && <p className="text-xs text-gray-500 mb-3 leading-relaxed">{s.descricao}</p>}
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-rose-600 font-bold text-lg">{formatCurrency(s.preco)}</span>
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    {s.duracao_minutos} min
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar serviço' : 'Novo serviço'}
      >
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="Nome do serviço"
            placeholder="Ex: Manicure completa"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preço (R$)"
              type="number"
              step="0.01"
              min="0"
              placeholder="50.00"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
              required
            />
            <Input
              label="Duração (min)"
              type="number"
              min="15"
              step="15"
              placeholder="60"
              value={form.duracao_minutos}
              onChange={(e) => setForm({ ...form, duracao_minutos: e.target.value })}
              required
            />
          </div>
          <Textarea
            label="Descrição (opcional)"
            placeholder="Descreva o que está incluído..."
            rows={3}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />

          <div>
            <label className="text-sm font-medium text-gray-700">Ícone do serviço</label>
            <div className="grid grid-cols-8 gap-2 mt-2">
              {SERVICO_ICONE_OPTIONS.map((nomeIcone) => {
                const IconeOpcao = getServicoIcone(nomeIcone)
                const selecionado = !usandoFoto && form.icone === nomeIcone
                return (
                  <button
                    key={nomeIcone}
                    type="button"
                    title={nomeIcone}
                    aria-label={nomeIcone}
                    onClick={() => { setForm({ ...form, icone: nomeIcone, fotoGaleriaId: null }); setMostrarSeletorFoto(false) }}
                    className={`aspect-square rounded-xl border flex items-center justify-center transition-colors ${
                      selecionado
                        ? 'border-rose-400 bg-rose-50 text-rose-500'
                        : 'border-gray-200 text-gray-400 hover:border-rose-200 hover:text-rose-400'
                    }`}
                  >
                    <IconeOpcao className="w-5 h-5" />
                  </button>
                )
              })}
            </div>

            {mostrarSeletorFoto ? (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">Escolha uma foto da galeria para usar como ícone</p>
                <SeletorFotoIcone
                  galeria={galeria}
                  selecionada={form.fotoGaleriaId}
                  onSelect={(id) => { setForm({ ...form, fotoGaleriaId: id }); setMostrarSeletorFoto(false) }}
                />
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-center gap-3">
                {usandoFoto && fotoAtualUrl && (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden ring-1 ring-gray-200 shrink-0">
                    <ImageWithSkeleton src={fotoAtualUrl} alt="Foto selecionada" fill className="object-cover" />
                  </div>
                )}
                <Button type="button" size="sm" onClick={() => setMostrarSeletorFoto(true)}>
                  <ImageIcon className="w-4 h-4" />
                  {usandoFoto ? 'Trocar foto' : 'Escolher da galeria'}
                </Button>
                {usandoFoto && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, fotoGaleriaId: null })}>
                    Remover foto
                  </Button>
                )}
              </div>
            )}
          </div>

          {profissionais.length > 0 && (
            <div>
              <label className="text-sm font-medium text-gray-700">Quem realiza este serviço</label>
              <p className="text-xs text-gray-400 mt-0.5 mb-2">Se nenhuma for marcada, o serviço fica disponível para todas</p>
              <div className="space-y-1.5">
                {profissionais.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 text-sm text-gray-700 cursor-pointer min-h-9">
                    <input
                      type="checkbox"
                      checked={profissionaisSelecionadas.includes(p.id)}
                      onChange={() => toggleProfissional(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-rose-400 focus:ring-rose-300"
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-rose-400" />
              <label className="text-sm font-medium text-gray-700">Pagamento online</label>
            </div>
            <ToggleComSubtexto
              label="Aceitar pagamento pelo app"
              subtexto="Sua cliente pode pagar online ao agendar"
              checked={form.aceitarPagamentoOnline}
              onChange={(v) => setForm({ ...form, aceitarPagamentoOnline: v })}
            />

            <div className="mt-2 pl-3 border-l-2 border-rose-100 space-y-3">
                <ToggleComSubtexto
                  label="Cobrar sinal obrigatório"
                  subtexto={form.aceitarPagamentoOnline
                    ? 'O agendamento só é confirmado após o pagamento do sinal'
                    : 'Ative o pagamento online primeiro'}
                  checked={form.sinalObrigatorio}
                  onChange={(v) => setForm({ ...form, sinalObrigatorio: v })}
                  disabled={!form.aceitarPagamentoOnline}
                />

                {form.aceitarPagamentoOnline && form.sinalObrigatorio && (
                  <div className="space-y-2">
                    <div className="flex gap-2" role="radiogroup" aria-label="Tipo de sinal">
                      {(['fixo', 'percentual'] as const).map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          role="radio"
                          aria-checked={form.sinalTipo === tipo}
                          onClick={() => setForm({ ...form, sinalTipo: tipo })}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-xl text-sm font-medium border transition-colors',
                            form.sinalTipo === tipo
                              ? 'border-rose-400 bg-rose-50 text-rose-600'
                              : 'border-gray-200 text-gray-500 hover:border-rose-200'
                          )}
                        >
                          {tipo === 'fixo' ? 'Valor fixo (R$)' : 'Percentual (%)'}
                        </button>
                      ))}
                    </div>
                    <Input
                      label={form.sinalTipo === 'fixo' ? 'Valor do sinal (R$)' : 'Percentual do sinal (%)'}
                      type="number"
                      step={form.sinalTipo === 'fixo' ? '0.01' : '1'}
                      min="0"
                      max={form.sinalTipo === 'percentual' ? '100' : undefined}
                      placeholder={form.sinalTipo === 'fixo' ? '30.00' : '50'}
                      value={form.sinalValor}
                      onChange={(e) => setForm({ ...form, sinalValor: e.target.value })}
                      required
                    />
                  </div>
                )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" loading={loading} className="flex-1">
              {editId ? 'Salvar' : 'Criar serviço'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover serviço?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Agendamentos existentes não serão afetados.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
            <Button variant="danger" onClick={() => deleteId && handleDelete(deleteId)} className="flex-1">
              Remover
            </Button>
          </div>
        </div>
      </Modal>
      </>
      )}
    </div>
  )
}
