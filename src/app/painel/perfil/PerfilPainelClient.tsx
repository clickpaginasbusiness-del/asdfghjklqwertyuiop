'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import {
  User, Link2, Upload, Phone, AtSign, MapPin, AlertTriangle,
  CheckCircle2, XCircle, Loader2, Palette, Lock, Check,
} from 'lucide-react'
import Image from 'next/image'
import type { Prestadora } from '@/lib/types'
import { maskTelefone, cleanTelefone, slugify } from '@/lib/utils'
import { TEMAS, type CorTema } from '@/lib/theme'
import toast from 'react-hot-toast'

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

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
  const router = useRouter()

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [slug, setSlug] = useState(initial.slug)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [savingSlug, setSavingSlug] = useState(false)

  const [corTema, setCorTema] = useState<CorTema>((initial.cor_tema as CorTema) || 'rosa')
  const [savingTema, setSavingTema] = useState(false)
  const ehPro = prestadora.plano === 'pro'

  useEffect(() => {
    if (slug === prestadora.slug || slug.length < 3) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('prestadoras')
        .select('id')
        .eq('slug', slug)
        .neq('id', prestadora.id)
        .maybeSingle()
      setSlugStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [slug, prestadora.slug, prestadora.id])

  async function salvarSlug() {
    setSavingSlug(true)
    const supabase = createClient()
    const { error } = await supabase.from('prestadoras').update({ slug }).eq('id', prestadora.id)
    if (error) {
      toast.error('Erro ao salvar link')
    } else {
      setPrestadora((p) => ({ ...p, slug }))
      setSlugStatus('idle')
      toast.success('Link atualizado!')
    }
    setSavingSlug(false)
  }

  async function salvarTema(cor: CorTema) {
    setCorTema(cor)
    setSavingTema(true)
    const supabase = createClient()
    const { error } = await supabase.from('prestadoras').update({ cor_tema: cor }).eq('id', prestadora.id)
    if (error) toast.error('Erro ao salvar cor')
    else {
      setPrestadora((p) => ({ ...p, cor_tema: cor }))
      toast.success('Cor da página atualizada!')
    }
    setSavingTema(false)
  }

  async function excluirConta() {
    setDeleting(true)
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erro ao excluir conta')
        setDeleting(false)
        return
      }
      const supabase = createClient()
      await supabase.auth.signOut()
      toast.success('Conta excluída com sucesso')
      router.push('/painel/login')
    } catch {
      toast.error('Erro ao excluir conta')
      setDeleting(false)
    }
  }

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
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 bg-rose-50 rounded-xl p-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">bellebook.com/n/{prestadora.slug}</p>
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

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Alterar link</label>
            <div className={`flex rounded-xl border overflow-hidden focus-within:ring-2 transition-all ${
              slugStatus === 'taken'
                ? 'border-red-300 focus-within:ring-red-200'
                : slugStatus === 'available'
                ? 'border-emerald-300 focus-within:ring-emerald-200'
                : 'border-gray-200 focus-within:ring-rose-300 focus-within:border-rose-300'
            }`}>
              <span className="bg-gray-50 px-3 py-2.5 text-sm text-gray-400 border-r border-gray-200 whitespace-nowrap">
                bellebook.com/n/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="seu-nome"
                className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
            {slugStatus === 'checking' && (
              <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Verificando disponibilidade...
              </p>
            )}
            {slugStatus === 'available' && (
              <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Disponível
              </p>
            )}
            {slugStatus === 'taken' && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium mt-1.5">
                <XCircle className="w-3.5 h-3.5" />
                Este link já está em uso
              </p>
            )}
            <Button
              className="mt-3"
              size="sm"
              disabled={slugStatus !== 'available'}
              loading={savingSlug}
              onClick={salvarSlug}
            >
              Salvar link
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personalização (exclusivo Pro) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-rose-400" />
            <CardTitle>Personalização</CardTitle>
          </div>
          <p className="text-sm text-gray-400">Escolha a cor principal da sua página pública</p>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="flex flex-wrap gap-3">
              {(Object.entries(TEMAS) as [CorTema, (typeof TEMAS)[CorTema]][]).map(([key, tema]) => (
                <button
                  key={key}
                  type="button"
                  disabled={!ehPro || savingTema}
                  onClick={() => salvarTema(key)}
                  title={tema.label}
                  className="flex flex-col items-center gap-1.5 disabled:cursor-not-allowed"
                >
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center ring-offset-2 transition-all"
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

            {!ehPro && (
              <div className="absolute inset-0 -m-2 rounded-xl bg-white/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 text-center p-4">
                <Lock className="w-6 h-6 text-gray-400" />
                <p className="text-sm font-semibold text-gray-700">Exclusivo do Plano Pro</p>
                <Link href="/painel/assinatura" className="text-xs font-semibold text-rose-500 hover:text-rose-600 underline underline-offset-2">
                  Fazer upgrade
                </Link>
              </div>
            )}
          </div>

          {ehPro && (
            <div className="mt-5 flex items-center gap-3 rounded-xl p-4" style={{ backgroundColor: TEMAS[corTema].hexLight }}>
              <span className="text-sm text-gray-600">Pré-visualização:</span>
              <span
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: TEMAS[corTema].hex }}
              >
                Botão de exemplo
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Excluir conta */}
      <Card className="border-red-100">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <CardTitle>Excluir minha conta</CardTitle>
          </div>
          <p className="text-sm text-gray-400">
            Esta ação é permanente. Todos os seus dados (agendamentos, serviços, profissionais, galeria e clientes) serão apagados e sua assinatura será cancelada.
          </p>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)}>
            Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Modal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setConfirmText('') }}
        title="Excluir conta permanentemente"
      >
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Esta ação não pode ser desfeita. Sua assinatura será cancelada e todos os seus dados serão excluídos definitivamente.
          </p>
          <p className="text-sm text-gray-600">
            Digite <span className="font-semibold text-gray-900">EXCLUIR</span> para confirmar:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="EXCLUIR"
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setConfirmText('') }}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== 'EXCLUIR'}
              loading={deleting}
              onClick={excluirConta}
            >
              Excluir conta
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
