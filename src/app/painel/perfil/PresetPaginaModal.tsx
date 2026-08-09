'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'
import type { PresetPagina } from '@/lib/types'

function PreviewClassico() {
  return (
    <svg viewBox="0 0 200 150" className="w-full h-auto" aria-hidden>
      <rect width="200" height="150" rx="10" fill="#fff1f2" />
      {/* header com foto de perfil */}
      <rect x="0" y="0" width="200" height="46" rx="10" fill="#fecdd3" />
      <circle cx="100" cy="23" r="14" fill="#fb7185" />
      <rect x="70" y="40" width="60" height="5" rx="2.5" fill="#fb7185" opacity="0.5" />
      {/* lista de serviços */}
      {[54, 70, 86].map((y) => (
        <g key={y}>
          <rect x="12" y={y} width="176" height="13" rx="4" fill="white" stroke="#fecdd3" strokeWidth="1" />
          <rect x="18" y={y + 4.5} width="6" height="6" rx="2" fill="#fda4af" />
          <rect x="30" y={y + 5} width="70" height="4" rx="2" fill="#d1d5db" />
          <rect x="165" y={y + 5} width="15" height="4" rx="2" fill="#fb7185" />
        </g>
      ))}
      {/* grade de fotos pequenas */}
      {[12, 46, 80, 114, 148].map((x) => (
        <rect key={x} x={x} y="104" width="28" height="20" rx="4" fill="#fda4af" opacity="0.55" />
      ))}
      {/* botão agendar */}
      <rect x="12" y="132" width="176" height="12" rx="6" fill="#fb7185" />
    </svg>
  )
}

function PreviewLanding() {
  return (
    <svg viewBox="0 0 200 150" className="w-full h-auto" aria-hidden>
      <rect width="200" height="150" rx="10" fill="#fff1f2" />
      {/* banner largo com texto sobre a imagem */}
      <rect x="0" y="0" width="200" height="50" rx="10" fill="#fb7185" />
      <rect x="0" y="30" width="200" height="20" fill="#fb7185" />
      <rect x="60" y="16" width="80" height="6" rx="3" fill="white" opacity="0.9" />
      <rect x="75" y="26" width="50" height="4" rx="2" fill="white" opacity="0.7" />
      {/* cards de profissionais lado a lado */}
      {[10, 74, 138].map((x) => (
        <g key={x}>
          <rect x={x} y="58" width="52" height="30" rx="5" fill="white" stroke="#fecdd3" strokeWidth="1" />
          <circle cx={x + 26} cy="70" r="7" fill="#fda4af" />
          <rect x={x + 14} y="80" width="24" height="3.5" rx="1.75" fill="#d1d5db" />
        </g>
      ))}
      {/* grade de fotos maior */}
      {[10, 55, 100, 145].map((x, i) => (
        <rect key={x} x={x} y="94" width="35" height={i % 2 === 0 ? 22 : 18} rx="4" fill="#fda4af" opacity="0.55" />
      ))}
      {/* mapa */}
      <rect x="10" y="120" width="70" height="14" rx="4" fill="#e5e7eb" />
      {/* seção de agendamento inline */}
      <rect x="86" y="120" width="104" height="14" rx="6" fill="#fb7185" />
    </svg>
  )
}

function PreviewPremium() {
  return (
    <svg viewBox="0 0 200 150" className="w-full h-auto" aria-hidden>
      <rect width="200" height="150" rx="10" fill="#1a1a1a" />
      {/* header centralizado */}
      <rect x="70" y="10" width="60" height="5" rx="2.5" fill="#fcd34d" opacity="0.6" />
      {/* foto de perfil grande centralizada */}
      <circle cx="100" cy="38" r="16" fill="none" stroke="#fcd34d" strokeWidth="2" />
      <circle cx="100" cy="38" r="13" fill="#3f3f46" />
      <rect x="78" y="60" width="44" height="5" rx="2.5" fill="white" opacity="0.85" />
      {/* cards de serviço com borda dourada */}
      {[74, 90].map((y) => (
        <rect key={y} x="16" y={y} width="168" height="12" rx="4" fill="#1a1a1a" stroke="#fcd34d" strokeOpacity="0.4" strokeWidth="1" />
      ))}
      {/* grid de fotos estilo editorial */}
      {[16, 84, 152].map((x) => (
        <rect key={x} x={x} y="108" width="64" height="20" fill="#3f3f46" />
      ))}
      {/* botão claro sobre fundo escuro */}
      <rect x="60" y="134" width="80" height="10" rx="5" fill="#fafafa" />
    </svg>
  )
}

const PRESETS: { id: PresetPagina; label: string; subtexto: string; Preview: () => React.JSX.Element }[] = [
  { id: 'classico', label: 'Clássico', subtexto: 'Simples e direto ao ponto', Preview: PreviewClassico },
  { id: 'landing', label: 'Landing Page', subtexto: 'Página completa e profissional', Preview: PreviewLanding },
  { id: 'premium', label: 'Premium', subtexto: 'Sofisticado e exclusivo', Preview: PreviewPremium },
]

export function PresetPaginaModal({
  open,
  onClose,
  presetAtual,
  podeUsarPresets,
  onAplicar,
}: {
  open: boolean
  onClose: () => void
  presetAtual: PresetPagina
  podeUsarPresets: boolean
  onAplicar: (preset: PresetPagina) => void
}) {
  const [selecionado, setSelecionado] = useState<PresetPagina>(presetAtual)

  function aplicar() {
    onAplicar(selecionado)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Escolha o estilo da sua página" className="max-w-3xl">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRESETS.map(({ id, label, subtexto, Preview }) => {
            const bloqueado = !podeUsarPresets && id !== presetAtual
            const selecionadoAtivo = selecionado === id
            return (
              <div key={id} className="relative">
                <button
                  type="button"
                  disabled={bloqueado}
                  onClick={() => setSelecionado(id)}
                  className={cn(
                    'w-full text-left rounded-2xl border-2 p-4 transition-all disabled:cursor-not-allowed',
                    selecionadoAtivo ? 'border-rose-400 bg-rose-50/40' : 'border-gray-100 hover:border-gray-200'
                  )}
                >
                  <div className="rounded-xl overflow-hidden mb-3 ring-1 ring-black/5">
                    <Preview />
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{label}</p>
                    {selecionadoAtivo && (
                      <span className="w-5 h-5 rounded-full bg-rose-400 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{subtexto}</p>
                </button>

                {bloqueado && (
                  <div className="absolute inset-0 rounded-2xl bg-white/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 text-center p-4">
                    <Lock className="w-5 h-5 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-700">Disponível a partir do Plano Studio</p>
                    <Link href="/painel/assinatura" className="text-xs font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2">
                      Fazer upgrade
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button type="button" size="sm" onClick={aplicar} disabled={!podeUsarPresets && selecionado !== presetAtual}>
            Aplicar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
