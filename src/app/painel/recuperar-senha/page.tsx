'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'https://nailbook-eta.vercel.app/painel/nova-senha',
    })
    // Sempre mostra sucesso para não revelar se o email existe
    setEnviado(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-3xl font-bold text-rose-400">NailBook</Link>
          <p className="text-gray-500 mt-2 text-sm">Recuperar senha</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {enviado ? (
            <div className="text-center space-y-3">
              <p className="text-sm font-medium text-gray-800">
                Enviamos um link de recuperação para seu email
              </p>
              <p className="text-xs text-gray-400">
                Verifique sua caixa de entrada e a pasta de spam
              </p>
              <Link
                href="/painel/login"
                className="inline-block text-sm text-rose-500 font-medium hover:underline mt-2"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 mb-6">
                Digite seu email para receber um link de redefinição de senha.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Email"
                  type="email"
                  placeholder="sua@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                  Enviar link de recuperação
                </Button>
              </form>
              <p className="text-center text-sm text-gray-500 mt-6">
                Lembrou a senha?{' '}
                <Link href="/painel/login" className="text-rose-500 font-medium hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
