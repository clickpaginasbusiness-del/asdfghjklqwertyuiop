'use client'

import { cn } from '@/lib/utils'
import { Check, ImageIcon } from 'lucide-react'
import type { GaleriaItem } from '@/lib/types'
import { ImageWithSkeleton } from '@/components/ui/image-with-skeleton'
import toast from 'react-hot-toast'

export function SeletorFotos({
  galeria,
  selecionadas,
  onChange,
  max,
}: {
  galeria: GaleriaItem[]
  selecionadas: string[]
  onChange: (ids: string[]) => void
  max: number
}) {
  function toggle(id: string) {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((s) => s !== id))
      return
    }
    if (selecionadas.length >= max) {
      toast.error(`Você pode selecionar no máximo ${max} fotos.`)
      return
    }
    onChange([...selecionadas, id])
  }

  if (galeria.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 border border-dashed border-gray-200 rounded-xl">
        <ImageIcon className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
        <p className="text-sm">Nenhuma foto na galeria ainda</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {galeria.map((item) => {
        const checked = selecionadas.includes(item.id)
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
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
