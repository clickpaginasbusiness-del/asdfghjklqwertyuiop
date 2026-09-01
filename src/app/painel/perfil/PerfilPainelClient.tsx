'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  User, Link2, Upload, Phone, AtSign, MapPin,
  CheckCircle2, XCircle, Loader2, Palette, MessageCircle,
  Gift, Shield, CalendarClock, Sparkles,
} from 'lucide-react'
import Image from 'next/image'
import type { Prestadora, GaleriaItem } from '@/lib/types'
import { maskTelefone, cleanTelefone, slugify, formatDate } from '@/lib/utils'
import { TEMPLATE_VARS, MSG_CONFIRMACAO_DEFAULT, MSG_CANCELAMENTO_DEFAULT, MSG_LEMBRETE_DEFAULT } from '@/lib/whatsappTemplates'
import { PersonalizarPaginaModal } from './PersonalizarPaginaModal'
import { CodigoIndicacaoCard } from '@/components/painel/CodigoIndicacaoCard'
import { RetrospectivasListaModal } from '@/components/retrospectiva/RetrospectivasListaModal'
import { RETROSPECTIVAS_ATIVAS } from '@/lib/retrospectiva'
import { ADMIN_EMAIL } from '@/lib/admin'
import { planoEfetivo, ehStudio } from '@/lib/plano'
import { getTema } from '@/lib/theme'
import { validarArquivo } from '@/lib/uploadValidation'
import toast from 'react-hot-toast'

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken'

export type AvaliacaoComCliente = {
  id: string
  nota: number
  comentario: string | null
  destaque: boolean
  created_at: string
  agendamentos: { clientes: { nome: string } | null; servicos: { nome: string } | null } | null
}

export default function PerfilPainelClient({
  prestadora: initial,
  avaliacoes,
  galeria,
  indicacoesCount,
  conversoesCount,
}: {
  prestadora: Prestadora
  avaliacoes: AvaliacaoComCliente[]
  galeria: GaleriaItem[]
  indicacoesCount: number
  conversoesCount: number
}) {
  const [prestadora, setPrestadora] = useState(initial)
  const [recompensaAoVivo, setRecompensaAoVivo] = useState(false)
  const [nome, setNome] = useState(initial.nome)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [whatsapp, setWhatsapp] = useState(maskTelefone(initial.whatsapp ?? ''))
  const [instagram, setInstagram] = useState(initial.instagram ?? '')
  const [endereco, setEndereco] = useState(initial.endereco ?? '')
  const [saving, setSaving] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoRef = useRef<HTMLInputElement>(null)

  const [slug, setSlug] = useState(initial.slug)
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle')
  const [savingSlug, setSavingSlug] = useState(false)

  const planoAtual = planoEfetivo({ plano: prestadora.plano, e_parceira: prestadora.e_parceira })
  const [personalizarOpen, setPersonalizarOpen] = useState(false)
  const [retrospectivasOpen, setRetrospectivasOpen] = useState(false)

  const [msgConfirmacao, setMsgConfirmacao] = useState(initial.mensagem_confirmacao ?? MSG_CONFIRMACAO_DEFAULT)
  const [msgCancelamento, setMsgCancelamento] = useState(initial.mensagem_cancelamento ?? MSG_CANCELAMENTO_DEFAULT)
  const [msgLembrete, setMsgLembrete] = useState(initial.mensagem_lembrete ?? MSG_LEMBRETE_DEFAULT)
  const [savingMsgs, setSavingMsgs] = useState(false)

  function updateSlug(value: string) {
    setSlug(value)
    setSlugStatus(value === prestadora.slug || value.length < 3 ? 'idle' : 'checking')
  }

  useEffect(() => {
    if (slug === prestadora.slug || slug.length < 3) return
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

  /* Realtime: reflete na hora quando o webhook do Mercado Pago processa uma
     recompensa de indicação (trial estendido ou desconto na próxima
     cobrança) — sem precisar recarregar a página. */
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`prestadora-${initial.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'prestadoras',
        filter: `id=eq.${initial.id}`,
      }, (payload) => {
        const novo = payload.new as Partial<Prestadora>
        setPrestadora((p) => ({ ...p, ...novo }))
        // Um novo trial_fim enquanto a página está aberta é, na prática, a
        // recompensa de indicação sendo processada pelo webhook — mostra o
        // aviso na hora, mesmo que essa seja a primeira recompensa (quando
        // conversoesCount, calculado no carregamento da página, ainda é 0).
        if (novo.trial_fim) setRecompensaAoVivo(true)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [initial.id])

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

  async function salvarMensagens() {
    setSavingMsgs(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('prestadoras')
      .update({
        mensagem_confirmacao: msgConfirmacao.trim() || null,
        mensagem_cancelamento: msgCancelamento.trim() || null,
        mensagem_lembrete: msgLembrete.trim() || null,
      })
      .eq('id', prestadora.id)
    if (error) toast.error('Erro ao salvar mensagens')
    else {
      setPrestadora((p) => ({
        ...p,
        mensagem_confirmacao: msgConfirmacao.trim() || null,
        mensagem_cancelamento: msgCancelamento.trim() || null,
        mensagem_lembrete: msgLembrete.trim() || null,
      }))
      toast.success('Mensagens salvas!')
    }
    setSavingMsgs(false)
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
    const erroValidacao = validarArquivo(file)
    if (erroValidacao) {
      toast.error(erroValidacao)
      if (fotoRef.current) fotoRef.current.value = ''
      return
    }
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

  const isAdmin = prestadora.email === ADMIN_EMAIL

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Meu Perfil</h1>
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Shield className="w-4 h-4" />
            Painel Admin
          </Link>
        )}
      </div>

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
                onChange={(e) => updateSlug(slugify(e.target.value))}
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

      {/* Personalização */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-rose-400" />
            <CardTitle>Personalização</CardTitle>
          </div>
          <p className="text-sm text-gray-400">Cores, textos, avaliações e fotos da sua página pública</p>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setPersonalizarOpen(true)}>
            <Palette className="w-4 h-4" />
            Personalizar Página
          </Button>
        </CardContent>
      </Card>

      {/* Mensagens de WhatsApp */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-rose-400" />
            <CardTitle>Mensagens de WhatsApp</CardTitle>
          </div>
          <p className="text-sm text-gray-400">
            Personalize os textos enviados às clientes. Variáveis disponíveis:{' '}
            {TEMPLATE_VARS.map((v) => `{${v.key}}`).join(', ')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            label="Mensagem de confirmação"
            value={msgConfirmacao}
            onChange={(e) => setMsgConfirmacao(e.target.value)}
            rows={3}
          />
          <Textarea
            label="Mensagem de cancelamento"
            value={msgCancelamento}
            onChange={(e) => setMsgCancelamento(e.target.value)}
            rows={3}
          />
          <Textarea
            label="Mensagem de lembrete"
            value={msgLembrete}
            onChange={(e) => setMsgLembrete(e.target.value)}
            rows={3}
          />
          <Button onClick={salvarMensagens} loading={savingMsgs}>Salvar mensagens</Button>
        </CardContent>
      </Card>

      {/* Indique e Ganhe */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-rose-400" />
            <CardTitle>Indique e Ganhe</CardTitle>
          </div>
          <p className="text-sm text-gray-400">
            Indique amigas e ganhe recompensas quando elas criarem conta e quando assinarem um plano
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-rose-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-rose-500">{indicacoesCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Indicadas</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{conversoesCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Assinaram</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{indicacoesCount + conversoesCount}</p>
              <p className="text-xs text-gray-500 mt-0.5">Recompensas</p>
            </div>
          </div>

          {/* Recompensas info */}
          <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 space-y-1.5">
            <p className="font-semibold">O que você ganha a cada indicação:</p>
            <p className="text-amber-700 flex items-start gap-1.5">
              <span aria-hidden>✓</span> Indicada cria conta → <strong>+7 dias grátis</strong>
            </p>
            <p className="text-amber-700 flex items-start gap-1.5">
              <span aria-hidden>✓</span> Indicada assina um plano → <strong>+30 dias grátis</strong>
            </p>
          </div>

          {/* Data da recompensa ativa (trial ou pausa de cobrança) */}
          {(conversoesCount > 0 || recompensaAoVivo) && prestadora.trial_fim && new Date(prestadora.trial_fim) > new Date() && (
            <div className="flex items-center gap-2 bg-blue-50 rounded-xl px-4 py-3 text-sm text-blue-800">
              <CalendarClock className="w-4 h-4 shrink-0" />
              {prestadora.e_trial ? (
                <span>Seu plano está gratuito até <strong>{formatDate(prestadora.trial_fim)}</strong></span>
              ) : (
                <span>Próxima cobrança em: <strong>{formatDate(prestadora.trial_fim)}</strong></span>
              )}
            </div>
          )}

          {/* Link de indicação */}
          <CodigoIndicacaoCard codigoIndicacao={prestadora.codigo_indicacao} />
        </CardContent>
      </Card>

      {/* Minhas Retrospectivas — temporariamente fora do ar, ver RETROSPECTIVAS_ATIVAS */}
      {RETROSPECTIVAS_ATIVAS && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-400" />
              Minhas Retrospectivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Todo início de mês, um resumo automático do seu negócio no mês anterior — no estilo Stories, pra baixar e compartilhar.
            </p>
            <Button variant="outline" onClick={() => setRetrospectivasOpen(true)}>
              <Sparkles className="w-4 h-4" />
              Ver Retrospectivas
            </Button>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-gray-400 text-center">
        Para excluir sua conta, acesse{' '}
        <Link href="/painel/configuracoes" className="underline underline-offset-2 hover:text-gray-600">
          Configurações
        </Link>
        .
      </p>

      <PersonalizarPaginaModal
        open={personalizarOpen}
        onClose={() => setPersonalizarOpen(false)}
        prestadora={prestadora}
        galeria={galeria}
        avaliacoes={avaliacoes}
        plano={planoAtual}
        onSaved={(patch) => setPrestadora((p) => ({ ...p, ...patch }))}
      />

      <RetrospectivasListaModal
        open={retrospectivasOpen}
        onClose={() => setRetrospectivasOpen(false)}
        prestadoraId={prestadora.id}
        mostrarProfissionalDestaque={ehStudio(planoAtual)}
        prestadoraNome={prestadora.nome}
        fotoUrl={prestadora.foto_url}
        tema={getTema(prestadora.cor_tema)}
      />
    </div>
  )
}
