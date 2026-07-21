'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ImageIcon, Lock, Trash2, Upload, X } from 'lucide-react'
import type { GaleriaItem } from '@/lib/types'
import Link from 'next/link'
import toast from 'react-hot-toast'
import Image from 'next/image'
import { ImageWithSkeleton } from '@/components/ui/image-with-skeleton'

export default function GaleriaClient({
  galeria: initial,
  prestadoraId,
  plano,
}: {
  galeria: GaleriaItem[]
  prestadoraId: string
  plano: 'basico' | 'pro' | null
}) {
  const [galeria, setGaleria] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const supabase = createClient()

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${prestadoraId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const tipo = file.type.startsWith('video') ? 'video' : 'imagem'

      const { error: uploadError } = await supabase.storage.from('galeria').upload(path, file)
      if (uploadError) { toast.error('Erro no upload'); continue }

      const { data: urlData } = supabase.storage.from('galeria').getPublicUrl(path)

      const { data: item, error: dbError } = await supabase
        .from('galeria')
        .insert({ prestadora_id: prestadoraId, url: urlData.publicUrl, tipo })
        .select()
        .single()

      if (dbError) { toast.error('Erro ao salvar'); continue }
      setGaleria((prev) => [item, ...prev])
    }

    toast.success('Upload concluído!')
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDelete(item: GaleriaItem) {
    const supabase = createClient()
    const path = item.url.split('/galeria/')[1]
    await supabase.storage.from('galeria').remove([path])
    await supabase.from('galeria').delete().eq('id', item.id)
    setGaleria((prev) => prev.filter((g) => g.id !== item.id))
    toast.success('Removido da galeria')
    setDeleteId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Galeria</h1>
        <Button onClick={() => fileRef.current?.click()} loading={uploading} size="sm">
          <Upload className="w-4 h-4" />
          Adicionar fotos
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {plano === 'basico' && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 text-sm">
          <Lock className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-amber-700">
            Sua galeria está oculta na sua página pública.{' '}
            <Link href="/planos" className="font-semibold underline underline-offset-2">
              Faça upgrade para o Pro
            </Link>
            {' '}para exibi-la.
          </span>
        </div>
      )}

      {galeria.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-16 text-gray-400">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma foto na galeria ainda</p>
              <Button onClick={() => fileRef.current?.click()} variant="outline" size="sm" className="mt-4">
                <Upload className="w-4 h-4" />
                Fazer upload
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {galeria.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 cursor-pointer"
              onClick={() => setPreview(item.url)}
            >
              {item.tipo === 'video' ? (
                <video src={item.url} className="w-full h-full object-cover" muted />
              ) : (
                <ImageWithSkeleton
                  src={item.url}
                  alt="Trabalho"
                  fill
                  className="object-cover transition-transform group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteId(item.id) }}
                className="absolute top-2 right-2 bg-white/90 text-red-500 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {item.tipo === 'video' && (
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                  Vídeo
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preview lightbox */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-xl">
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-3xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <Image src={preview} alt="Preview" width={800} height={600} className="rounded-2xl max-h-[80vh] object-contain" />
          </div>
        </div>
      )}

      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remover foto?">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">A foto será removida da galeria pública.</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteId(null)} className="flex-1">Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => { const item = galeria.find(g => g.id === deleteId); if (item) handleDelete(item) }}
              className="flex-1"
            >
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
