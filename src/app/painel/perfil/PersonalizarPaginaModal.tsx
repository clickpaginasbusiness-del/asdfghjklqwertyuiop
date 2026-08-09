'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { SeletorFotos } from './SeletorFotos'
import { AvaliacoesDestaqueSection } from './AvaliacoesDestaqueSection'
import { PresetPaginaModal } from './PresetPaginaModal'
import { TEMAS, TEMA_DEFAULT, getTema, type CorTema } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ImageWithSkeleton } from '@/components/ui/image-with-skeleton'
import { Palette, Type, Star, Images, Home, Eye, Check, Lock, Pencil, LayoutTemplate, ImageIcon } from 'lucide-react'
import type { Prestadora, GaleriaItem, PresetPagina } from '@/lib/types'
import type { AvaliacaoComCliente } from './PerfilPainelClient'
import { ehPro as calcEhPro, type Plano } from '@/lib/plano'
import { limitesPlano } from '@/lib/planoLimites'
import toast from 'react-hot-toast'

const NOME_PRESET: Record<PresetPagina, string> = { classico: 'Clássico', landing: 'Landing Page' }

function SeletorFotoUnica({ galeria, selecionada, onChange }: { galeria: GaleriaItem[]; selecionada: string | null; onChange: (id: string | null) => void }) {
  if (galeria.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400 border border-dashed border-gray-200 rounded-xl">
        <ImageIcon className="w-5 h-5 mx-auto mb-1 opacity-30" />
        <p className="text-xs">Nenhuma foto na galeria ainda</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {galeria.map((item) => {
        const checked = selecionada === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(checked ? null : item.id)}
            className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100"
          >
            {item.tipo === 'video' ? (
              <video src={item.url} className="w-full h-full object-cover" muted />
            ) : (
              <ImageWithSkeleton src={item.url} alt="Foto" fill className="object-cover" />
            )}
            <div className={cn('absolute inset-0 transition-colors', checked ? 'bg-rose-400/30' : 'bg-black/0 group-hover:bg-black/10')} />
            <span
              className={cn(
                'absolute top-1.5 right-1.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                checked ? 'bg-rose-400 border-rose-400' : 'bg-white/80 border-white'
              )}
            >
              {checked && <Check className="w-3.5 h-3.5 text-white" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

type ModoExibicao = 'empilhada' | 'carrossel'

function ModoSelector({ value, onChange }: { value: ModoExibicao; onChange: (v: ModoExibicao) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-gray-200 p-1 bg-gray-50">
      {(['empilhada', 'carrossel'] as const).map((modo) => (
        <button
          key={modo}
          type="button"
          onClick={() => onChange(modo)}
          className={cn(
            'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
            value === modo ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {modo === 'empilhada' ? 'Empilhada' : 'Carrossel'}
        </button>
      ))}
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      {icon}
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
  )
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </label>
  )
}

interface PersonalizarPaginaModalProps {
  open: boolean
  onClose: () => void
  prestadora: Prestadora
  galeria: GaleriaItem[]
  avaliacoes: AvaliacaoComCliente[]
  plano: Plano | null
  onSaved: (patch: Partial<Prestadora>) => void
}

export function PersonalizarPaginaModal(props: PersonalizarPaginaModalProps) {
  if (!props.open) return null
  return <PersonalizarPaginaModalInner {...props} />
}

function PersonalizarPaginaModalInner({
  onClose,
  prestadora,
  galeria,
  avaliacoes,
  plano,
  onSaved,
}: Omit<PersonalizarPaginaModalProps, 'open'>) {
  const ehPro = calcEhPro(plano)
  const limites = limitesPlano(plano)
  const [corTema, setCorTema] = useState<string>(prestadora.cor_tema || TEMA_DEFAULT)
  const [hexDraft, setHexDraft] = useState(getTema(prestadora.cor_tema || TEMA_DEFAULT).hex.replace('#', ''))
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [textoAgendamento, setTextoAgendamento] = useState(prestadora.pagina_texto_agendamento ?? 'Agendamento online 24h')
  const [mostrarTextoAgendamento, setMostrarTextoAgendamento] = useState(prestadora.pagina_mostrar_texto_agendamento)
  const [mostrarEstrelas, setMostrarEstrelas] = useState(prestadora.pagina_mostrar_estrelas)
  const [mostrarAvaliacoes, setMostrarAvaliacoes] = useState(prestadora.pagina_mostrar_avaliacoes)
  const [mostrarGaleria, setMostrarGaleria] = useState(prestadora.pagina_mostrar_galeria)
  const [galeriaModo, setGaleriaModo] = useState<ModoExibicao>(prestadora.pagina_galeria_modo)
  const [galeriaFotosIds, setGaleriaFotosIds] = useState<string[]>(prestadora.pagina_galeria_fotos_ids)
  const [mostrarEstabelecimento, setMostrarEstabelecimento] = useState(prestadora.pagina_mostrar_estabelecimento)
  const [estabelecimentoModo, setEstabelecimentoModo] = useState<ModoExibicao>(prestadora.pagina_estabelecimento_modo)
  const [estabelecimentoFotosIds, setEstabelecimentoFotosIds] = useState<string[]>(prestadora.pagina_estabelecimento_fotos_ids)
  const [estabelecimentoTitulo, setEstabelecimentoTitulo] = useState(prestadora.pagina_estabelecimento_titulo ?? 'Nosso espaço')
  const [paginaPreset, setPaginaPreset] = useState<PresetPagina>(prestadora.pagina_preset)
  const [bannerFotoId, setBannerFotoId] = useState<string | null>(prestadora.pagina_banner_foto_id)
  const [presetModalOpen, setPresetModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const temaAtual = getTema(corTema)

  function applyCor(hex: string) {
    setCorTema(hex)
    setHexDraft(hex.replace('#', ''))
  }

  function selecionarPreset(key: CorTema) {
    setCorTema(key)
    setHexDraft(TEMAS[key].hex.replace('#', ''))
  }

  function handleHexChange(raw: string) {
    const clean = raw.replace(/[^0-9a-f]/gi, '').slice(0, 6)
    setHexDraft(clean)
    if (/^[0-9a-f]{6}$/i.test(clean)) setCorTema(`#${clean}`)
  }

  async function salvar() {
    setSaving(true)
    const supabase = createClient()
    const patch = {
      cor_tema: corTema,
      pagina_texto_agendamento: textoAgendamento.trim() || null,
      pagina_mostrar_texto_agendamento: mostrarTextoAgendamento,
      pagina_mostrar_estrelas: mostrarEstrelas,
      pagina_mostrar_avaliacoes: mostrarAvaliacoes,
      pagina_mostrar_galeria: mostrarGaleria,
      pagina_galeria_modo: galeriaModo,
      pagina_galeria_fotos_ids: galeriaFotosIds,
      pagina_mostrar_estabelecimento: mostrarEstabelecimento,
      pagina_estabelecimento_modo: estabelecimentoModo,
      pagina_estabelecimento_fotos_ids: estabelecimentoFotosIds,
      pagina_estabelecimento_titulo: estabelecimentoTitulo.trim() || null,
      pagina_preset: paginaPreset,
      pagina_banner_foto_id: bannerFotoId,
    }
    const { error } = await supabase.from('prestadoras').update(patch).eq('id', prestadora.id)
    if (error) {
      toast.error('Erro ao salvar personalização')
    } else {
      onSaved(patch)
      toast.success('Página personalizada!')
      onClose()
    }
    setSaving(false)
  }

  return (
    <Modal open onClose={onClose} title="Personalizar Página" className="max-w-2xl">
      <div className="p-6 space-y-8">
        {/* Preset da página */}
        <section>
          <button
            type="button"
            onClick={() => setPresetModalOpen(true)}
            className="w-full flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 hover:border-gray-200 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
              <LayoutTemplate className="w-5 h-5 text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Preset da página</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Estilo atual: {NOME_PRESET[paginaPreset]}
                {!limites.presets && ' · Landing Page exclusivo do Studio'}
              </p>
            </div>
            <span className="text-xs font-semibold text-rose-500 shrink-0">Escolher</span>
          </button>
        </section>

        {/* Aparência */}
        <section>
          <SectionHeader icon={<Palette className="w-5 h-5 text-rose-400" />} title="Aparência" />
          <div className="space-y-5 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => colorInputRef.current?.click()}
                  title="Escolher cor"
                  className="w-12 h-12 rounded-2xl shadow-sm ring-1 ring-black/5 hover:brightness-95 transition-all"
                  style={{ backgroundColor: temaAtual.hex }}
                />
                <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow ring-1 ring-black/5 flex items-center justify-center pointer-events-none">
                  <Pencil className="w-2.5 h-2.5 text-gray-500" />
                </span>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={temaAtual.hex}
                  onChange={(e) => applyCor(e.target.value)}
                  className="sr-only"
                  tabIndex={-1}
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-1.5">Clique no círculo para escolher qualquer cor</p>
                <div className="flex items-center rounded-xl border border-gray-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-rose-300 focus-within:border-rose-300 transition-all w-32">
                  <span className="pl-3 text-sm text-gray-400 select-none">#</span>
                  <input
                    type="text"
                    value={hexDraft}
                    onChange={(e) => handleHexChange(e.target.value)}
                    onBlur={() => setHexDraft(temaAtual.hex.replace('#', ''))}
                    placeholder="f472b6"
                    maxLength={6}
                    className="flex-1 min-w-0 px-2 py-2 text-sm uppercase focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Ou escolha uma cor pronta</p>
              <div className="flex flex-wrap gap-3">
                {(Object.entries(TEMAS) as [CorTema, (typeof TEMAS)[CorTema]][]).map(([key, tema]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selecionarPreset(key)}
                    title={tema.label}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center ring-offset-2 transition-all"
                      style={{
                        backgroundColor: tema.hex,
                        boxShadow: corTema === key ? `0 0 0 2px white, 0 0 0 4px ${tema.hex}` : undefined,
                      }}
                    >
                      {corTema === key && <Check className="w-4 h-4 text-white" />}
                    </span>
                    <span className="text-[11px] text-gray-500">{tema.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: temaAtual.hexLight }}>
              <span className="text-sm text-gray-600">Pré-visualização:</span>
              <span className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: temaAtual.hex }}>
                Botão de exemplo
              </span>
            </div>
          </div>
        </section>

        {/* Textos e badges */}
        <section className="pt-6 border-t border-gray-100">
          <SectionHeader icon={<Type className="w-5 h-5 text-rose-400" />} title="Textos e badges" />
          <div className="space-y-3">
            <ToggleRow label="Mostrar texto abaixo do nome" checked={mostrarTextoAgendamento} onChange={setMostrarTextoAgendamento} />
            {mostrarTextoAgendamento && (
              <input
                type="text"
                value={textoAgendamento}
                onChange={(e) => setTextoAgendamento(e.target.value)}
                placeholder="Agendamento online 24h"
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
              />
            )}
            <ToggleRow
              label="Mostrar média de estrelas e total de avaliações"
              checked={mostrarEstrelas}
              onChange={setMostrarEstrelas}
            />
          </div>
        </section>

        {/* Avaliações */}
        <section className="pt-6 border-t border-gray-100">
          <SectionHeader icon={<Star className="w-5 h-5 text-rose-400" />} title="Avaliações" />
          <ToggleRow
            label='Mostrar seção "O que dizem sobre mim"'
            checked={mostrarAvaliacoes}
            onChange={setMostrarAvaliacoes}
          />
          {mostrarAvaliacoes && (
            <div className="mt-4">
              <AvaliacoesDestaqueSection ehPro={ehPro} avaliacoesIniciais={avaliacoes} />
            </div>
          )}
        </section>

        {/* Galeria de trabalhos */}
        <section className="pt-6 border-t border-gray-100">
          <SectionHeader icon={<Images className="w-5 h-5 text-rose-400" />} title="Galeria de trabalhos" />
          <ToggleRow label="Mostrar galeria na página pública" checked={mostrarGaleria} onChange={setMostrarGaleria} />
          {mostrarGaleria && (
            <div className="space-y-4 mt-4">
              <ModoSelector value={galeriaModo} onChange={setGaleriaModo} />
              <p className="text-xs text-gray-400">
                {limites.fotos_trabalhos === Infinity
                  ? `Fotos ilimitadas (${galeriaFotosIds.length} selecionadas)`
                  : `Selecione até ${limites.fotos_trabalhos} fotos (${galeriaFotosIds.length}/${limites.fotos_trabalhos} selecionadas)`}
              </p>
              <SeletorFotos galeria={galeria} selecionadas={galeriaFotosIds} onChange={setGaleriaFotosIds} max={limites.fotos_trabalhos} />

              {paginaPreset === 'landing' && (
                <div className="pt-4 mt-2 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-1">Foto do banner (hero)</p>
                  <p className="text-xs text-gray-400 mb-3">
                    Usada como imagem de fundo no topo da página landing. Se não escolher, usa a primeira foto da galeria de trabalhos.
                  </p>
                  <SeletorFotoUnica galeria={galeria} selecionada={bannerFotoId} onChange={setBannerFotoId} />
                  <p className="text-xs text-gray-400 mt-2">
                    Para melhor resultado, use uma foto horizontal com resolução mínima de 1200×400px
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Fotos do estabelecimento */}
        <section className="pt-6 border-t border-gray-100">
          <SectionHeader icon={<Home className="w-5 h-5 text-rose-400" />} title="Fotos do estabelecimento" />
          <div className="relative">
            <div className={cn('space-y-4', limites.fotos_estabelecimento === 0 && 'pointer-events-none opacity-60')}>
              <ToggleRow label="Mostrar seção de fotos do espaço" checked={mostrarEstabelecimento} onChange={setMostrarEstabelecimento} disabled={limites.fotos_estabelecimento === 0} />
              {mostrarEstabelecimento && (
                <>
                  <input
                    type="text"
                    value={estabelecimentoTitulo}
                    onChange={(e) => setEstabelecimentoTitulo(e.target.value)}
                    placeholder="Nosso espaço"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
                  />
                  <ModoSelector value={estabelecimentoModo} onChange={setEstabelecimentoModo} />
                  <p className="text-xs text-gray-400">
                    {limites.fotos_estabelecimento === Infinity
                      ? `Fotos ilimitadas (${estabelecimentoFotosIds.length} selecionadas)`
                      : `Selecione até ${limites.fotos_estabelecimento} fotos (${estabelecimentoFotosIds.length}/${limites.fotos_estabelecimento} selecionadas)`}
                  </p>
                  <SeletorFotos galeria={galeria} selecionadas={estabelecimentoFotosIds} onChange={setEstabelecimentoFotosIds} max={limites.fotos_estabelecimento} />
                </>
              )}
            </div>
            {limites.fotos_estabelecimento === 0 && (
              <div className="absolute inset-0 -m-2 rounded-xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
                <Lock className="w-6 h-6 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Disponível a partir do Plano Pro</p>
                <Link href="/painel/assinatura" className="text-xs font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2">
                  Fazer upgrade
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex items-center justify-between gap-3 p-6 pt-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => window.open(`${window.location.origin}/n/${prestadora.slug}`, '_blank')}
        >
          <Eye className="w-4 h-4" />
          Ver minha página
        </Button>
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" onClick={salvar} loading={saving}>Salvar alterações</Button>
        </div>
      </div>

      <PresetPaginaModal
        open={presetModalOpen}
        onClose={() => setPresetModalOpen(false)}
        presetAtual={paginaPreset}
        podeUsarPresets={limites.presets}
        onAplicar={setPaginaPreset}
      />
    </Modal>
  )
}
