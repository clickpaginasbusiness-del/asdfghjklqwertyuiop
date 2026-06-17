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

export default function CadastroPage() {
  const [step, setStep] = useState<'form' | 'otp'>('form')

  // Step 1 fields
  const [nome, setNome] = useState('')
  const [slug, setSlug] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')

  // Step 2
  const [codigo, setCodigo] = useState('')
  const [phoneFormatted, setPhoneFormatted] = useState('')

  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [loadingOtp, setLoadingOtp] = useState(false)
  const [loadingCreate, setLoadingCreate] = useState(false)

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

  async function handleEnviarCodigo(e: React.FormEvent) {
    e.preventDefault()
    if (slug.length < 3) { toast.error('O link deve ter pelo menos 3 caracteres'); return }
    if (slugStatus === 'taken') { toast.error('Este link já está em uso, escolha outro'); return }
    if (slugStatus === 'checking') { toast.error('Aguarde a verificação do link'); return }
    if (senha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    const digits = telefone.replace(/\D/g, '')
    if (digits.length < 10) { toast.error('Informe um telefone válido com DDD'); return }

    const phone = formatPhone(telefone)
    setPhoneFormatted(phone)
    setLoadingOtp(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({ phone })
      if (error) { toast.error(error.message ?? 'Erro ao enviar SMS'); return }
      setStep('otp')
      toast.success('Código enviado por SMS!')
    } finally {
      setLoadingOtp(false)
    }
  }

  async function handleReenviar() {
    setLoadingOtp(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({ phone: phoneFormatted, options: { channel: 'sms' } })
      if (error) { toast.error('Erro ao reenviar código'); return }
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
      const supabase = createClient()

      // Verify OTP — @supabase/ssr stores the session in cookies automatically
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: phoneFormatted,
        token: codigo,
        type: 'sms',
      })

      if (verifyError) {
        toast.error('Código inválido ou expirado.')
        return
      }

      // Server reads the phone session from cookies and completes signup
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, senha, slug, telefone: phoneFormatted }),
      })

      const json = await res.json()

      if (!res.ok) {
        if (res.status === 409 && json.error?.includes('telefone')) {
          toast.error('Telefone já cadastrado. Faça login.')
          window.location.href = '/painel/login'
          return
        }
        toast.error(json.error ?? 'Erro ao criar conta')
        // Slug or email conflict — go back to form to fix
        if (json.error?.includes('link') || json.error?.includes('email')) setStep('form')
        return
      }

      toast.success('Conta criada! Bem-vinda ao BelleBook 🎉')
      const planIntent = new URLSearchParams(window.location.search).get('plano')
      window.location.href = planIntent === 'pro' ? '/planos?auto=pro' : '/painel'
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
          <p className="text-gray-500 mt-2 text-sm">30 dias grátis · Sem cartão de crédito</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleEnviarCodigo} className="flex flex-col gap-4">
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
                  nailbook.com/n/
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
            <Input
              label="Email"
              type="email"
              placeholder="sua@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Senha"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              minLength={6}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Telefone (com DDD)</label>
              <input
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(applyPhoneMask(e.target.value))}
                placeholder="(11) 99999-9999"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 transition-all"
                required
              />
              <p className="text-xs text-gray-400">Receberá um SMS para verificar sua conta</p>
            </div>

            <Button
              type="submit"
              loading={loadingOtp}
              disabled={loadingOtp || slugStatus === 'taken' || slugStatus === 'checking'}
              className="w-full mt-2"
              size="lg"
            >
              Enviar código SMS
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Já tem conta?{' '}
            <Link href="/painel/login" className="text-rose-500 font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          30 dias grátis no Plano Básico · Sem cartão · Cancele quando quiser
        </p>
      </div>
    </div>
  )
}
