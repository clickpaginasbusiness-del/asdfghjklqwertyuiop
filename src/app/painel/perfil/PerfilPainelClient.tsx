'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { User, Link2, Upload, Phone, AtSign, MapPin } from 'lucide-react'
import Image from 'next/image'
import type { Prestadora } from '@/lib/types'
import { maskTelefone, cleanTelefone } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function PerfilPainelClient({ prestadora: initial }: { prestadora: Prestadora }) {
  const [prestadora, setPrestadora] = useState(initial)
  const [nome, setNome] = useState(initial.nome)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [whatsapp, setWhatsapp] = useState(maskTelefone(initial.whatsapp ?? ''))
  const [instagram, setInstagram] = useState(initial.instagram ?? '')
  const [endereco, setEndereco] = useState(initial.endereco ?? '')
  const [saving, setSaving] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  async function salvarPerfil() {
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('prestadoras')
      .update({
        nome,
        bio: bio || null,
        whatsapp: cleanTelefone(whatsapp) || null,
        instagram: instagram.replace('@', '').trim() || null,
        endereco: endereco.trim() || null,
      })
      .eq('id', prestadora.id)
    if (error) toast.error('Erro ao salvar')
    else {
      setPrestadora((p) => ({ ...p, nome, bio, whatsapp: cleanTelefone(whatsapp) || null, instagram: instagram.replace('@', '').trim() || null, endereco: endereco.trim() || null }))
      toast.success('Perfil salvo!')
    }
    setSaving(false)
  }

  async function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop()
    const path = `${prestadora.id}/avatar.${ext}`
    const { error: upError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upError) { toast.error('Erro no upload'); setUploadingFoto(false); return }
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
    const fotoUrl = `${urlData.publicUrl}?t=${Date.now()}`
    await supabase.from('prestadoras').update({ foto_url: fotoUrl }).eq('id', prestadora.id)
    setPrestadora((p) => ({ ...p, foto_url: fotoUrl }))
    toast.success('Foto atualizada!')
    setUploadingFoto(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Meu Perfil</h1>

      {/* Foto */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-rose-400" />
            <CardTitle>Foto de perfil</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-rose-100 border-2 border-rose-100 shrink-0">
              {prestadora.foto_url ? (
                <Image src={prestadora.foto_url} alt="Foto" width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-rose-300 font-bold text-3xl font-serif">
                  {prestadora.nome.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={() => fotoRef.current?.click()} loading={uploadingFoto}>
                <Upload className="w-4 h-4" />
                {uploadingFoto ? 'Enviando...' : 'Alterar foto'}
              </Button>
              <p className="text-xs text-gray-400 mt-1.5">JPG ou PNG. Máx 5MB.</p>
            </div>
            <input ref={fotoRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
          </div>
        </CardContent>
      </Card>

      {/* Dados */}
      <Card>
        <CardHeader>
          <CardTitle>Dados do perfil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Seu nome"
          />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Email</label>
            <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5">{prestadora.email}</p>
          </div>
          <Textarea
            label="Bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Conte um pouco sobre você e seu trabalho..."
            rows={3}
          />
          <Button onClick={salvarPerfil} loading={saving}>Salvar perfil</Button>
        </CardContent>
      </Card>

      {/* Contatos */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-rose-400" />
            <CardTitle>Contatos</CardTitle>
          </div>
          <p className="text-sm text-gray-400">Aparecem na sua página pública com botões clicáveis</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">WhatsApp</label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-rose-300 focus-within:border-rose-300 transition-all">
              <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-400 border-r border-gray-200">+55</span>
              <input
                type="tel"
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskTelefone(e.target.value))}
                placeholder="(11) 99999-9999"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              <AtSign className="w-4 h-4 inline mr-1 text-rose-400" />
              Instagram
            </label>
            <div className="flex rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-rose-300 focus-within:border-rose-300 transition-all">
              <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-400 border-r border-gray-200">@</span>
              <input
                type="text"
                value={instagram.replace('@', '')}
                onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                placeholder="seu_perfil"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">
              <MapPin className="w-4 h-4 inline mr-1 text-rose-400" />
              Endereço
            </label>
            <input
              type="text"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Rua das Flores, 123 — São Paulo, SP"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
            />
          </div>

          <Button onClick={salvarPerfil} loading={saving}>Salvar contatos</Button>
        </CardContent>
      </Card>

      {/* Link público */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-rose-400" />
            <CardTitle>Seu link público</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 bg-rose-50 rounded-xl p-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">nailbook.com/n/{prestadora.slug}</p>
              <p className="text-xs text-gray-400 mt-0.5">Compartilhe com suas clientes</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/n/${prestadora.slug}`)
                toast.success('Link copiado!')
              }}
            >
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
