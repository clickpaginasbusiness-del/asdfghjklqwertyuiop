'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { slugify } from '@/lib/utils'
import toast from 'react-hot-toast'
import { Phone, ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return `+${digits}`
  return `+55${digits}`
}

export default function CompletarCadastroGoogleClient({
  email,
  nomeInicial,
  refCode,
}: {
  email: string
  nomeInicial: string
  refCode: string
}) {
  const [step, setStep] = useState<'form' | 'otp'>('form')

  const [nome, setNome] = useState(nomeInicial)
  const [slug, setSlug] = useState('')
  const [telefone, setTelefone] = useState('')
  const [codigo, setCodigo] = useState('')
  const [phoneFormatted, setPhoneFormatted] = useState('')
  const [aceitouTermos, setAceitouTermos] = useState(false)

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [loadingOtp, setLoadingOtp] = useState(false)
  const [loadingCreate, setLoadingCreate] = useState(false)

  useEffect(() => {
    if (nomeInicial && !slug) setSlug(slugify(nomeInicial))
  }, [nomeInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (slug.length < 3) { setSlugStatus('idle'); return }
    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('prestadoras')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
      setSlugStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [slug])

  function handleNomeChange(value: string) {
    setNome(value)
    if (!slug || slug === slugify(nome)) setSlug(slugify(value))
  }

  async function handleEnviarSms(e: React.FormEvent) {
    e.preventDefault()
    if (slug.length < 3) { toast.error('O link deve ter pelo menos 3 caracteres'); return }
    if (slugStatus === 'taken') { toast.error('Este link já está em uso'); return }
    if (slugStatus === 'checking') { toast.error('Aguarde a verificação do link'); return }
    if (!aceitouTermos) { toast.error('Você precisa aceitar os Termos de Uso'); return }

    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) { toast.error('Informe um telefone válido com DDD'); return }

    const phone = formatPhone(telefone)
    setPhoneFormatted(phone)
    setPhoneError(null)
    setLoadingOtp(true)

    try {
      const res = await fetch('/api/auth/google/enviar-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: phone }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setPhoneError(data.error ?? 'Telefone já em uso')
        } else {
          toast.error(data.error ?? 'Erro ao enviar SMS')
        }
        return
      }
      setStep('otp')
      toast.success('Código enviado por SMS!')
    } finally {
      setLoadingOtp(false)
    }
  }

  async function handleReenviar() {
    setLoadingOtp(true)
    try {
      const res = await fetch('/api/auth/google/enviar-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: phoneFormatted }),
      })
      if (!res.ok) { toast.error('Erro ao reenviar código'); return }
      setCodigo('')
      toast.success('Novo código enviado!')
    } finally {
      setLoadingOtp(false)
    }
  }

  async function handleCriarConta(e: React.FormEvent) {
    e.preventDefault()
    if (codigo.length !== 6) { toast.error('O código deve ter 6 dígitos'); return }

    setLoadingCreate(true)
    try {
      const res = await fetch('/api/auth/google/completar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, slug, telefone: phoneFormatted, codigo, refCode }),
      })
      const json = await res.json()

      if (!res.ok) {
        if (res.status === 400 && json.error?.includes('código')) {
          toast.error('Código inválido ou expirado.')
          return
        }
        toast.error(json.error ?? 'Erro ao criar conta')
        if (json.error?.includes('link')) setStep('form')
        return
      }

      if (json.semTrial) {
        toast.error('Você já utilizou o período gratuito anteriormente. Escolha um plano para continuar.')
        window.location.href = '/planos'
        return
      }

      toast.success('Conta criada! Bem-vinda ao BelleBook 🎉')
      window.location.href = '/painel'
    } finally {
      setLoadingCreate(false)
    }
  }

  /* ── STEP 2: OTP ── */
  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link href="/" className="font-serif text-3xl font-bold text-rose-400">BelleBook</Link>
            <p className="text-gray-500 mt-2 text-sm">Verificação por SMS</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-rose-400" />
              </div>
              <p className="text-sm text-gray-600">
                Enviamos um código para<br />
                <span className="font-semibold text-gray-900">{phoneFormatted}</span>
              </p>
            </div>

            <form onSubmit={handleCriarConta} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Código de verificação</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl font-bold tracking-[0.5em] border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                  autoFocus
                  required
                />
              </div>
              <Button type="submit" loading={loadingCreate} className="w-full mt-2" size="lg">
                Criar conta
              </Button>
            </form>

            <div className="flex items-center justify-between mt-5 text-sm text-gray-500">
              <button
                onClick={() => setStep('form')}
                className="flex items-center gap-1 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
              <button
                onClick={handleReenviar}
                disabled={loadingOtp}
                className="text-rose-500 font-medium hover:underline disabled:opacity-50"
              >
                {loadingOtp ? 'Enviando...' : 'Reenviar código'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  /* ── STEP 1: FORM ── */
  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-3xl font-bold text-rose-400">BelleBook</Link>
          <p className="text-gray-500 mt-2 text-sm">Complete seu cadastro</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {refCode && (
            <div className="mb-5 bg-rose-50 rounded-xl px-4 py-3 text-sm text-rose-700">
              🎉 Você foi indicado! Código: <span className="font-semibold">{refCode}</span>
            </div>
          )}

          <form onSubmit={handleEnviarSms} className="flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Email (Google)</label>
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-2.5">{email}</p>
            </div>

            <Input
              label="Seu nome"
              placeholder="Ana Nails"
              value={nome}
              onChange={(e) => handleNomeChange(e.target.value)}
              required
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Seu link público</label>
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
                  placeholder="ana-nails"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                  required
                />
              </div>
              {slugStatus === 'checking' && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando disponibilidade...
                </p>
              )}
              {slugStatus === 'available' && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Disponível
                </p>
              )}
              {slugStatus === 'taken' && (
                <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                  <XCircle className="w-3.5 h-3.5" />
                  Este link já está em uso, escolha outro
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Telefone (com DDD)</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => { setTelefone(applyPhoneMask(e.target.value)); setPhoneError(null) }}
                placeholder="(11) 99999-9999"
                className={`border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${
                  phoneError
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-gray-200 focus:ring-rose-300 focus:border-rose-300'
                }`}
                required
              />
              {phoneError ? (
                <p className="text-xs text-red-500">{phoneError}</p>
              ) : (
                <p className="text-xs text-gray-400">Receberá um SMS para verificar sua conta</p>
              )}
            </div>

            <label className="flex items-start gap-2.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-rose-400 focus:ring-rose-300 shrink-0"
              />
              <span>
                Concordo com os{' '}
                <Link href="/termos" target="_blank" className="text-rose-500 font-medium hover:underline">
                  Termos de Uso
                </Link>
                {' '}e a{' '}
                <Link href="/privacidade" target="_blank" className="text-rose-500 font-medium hover:underline">
                  Política de Privacidade
                </Link>
              </span>
            </label>

            <Button
              type="submit"
              loading={loadingOtp}
              disabled={loadingOtp || slugStatus === 'taken' || slugStatus === 'checking' || !aceitouTermos}
              className="w-full mt-2"
              size="lg"
            >
              Enviar código SMS
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          30 dias grátis no Plano Básico · Sem cartão · Cancele quando quiser
        </p>
      </div>
    </div>
  )
}
