'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast from 'react-hot-toast'

export default function NovaSenhaPage() {
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const tokenHash = params.get('token_hash')
    const supabase = createClient()

    async function exchange() {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) { setErro('Link inválido ou expirado. Solicite um novo.'); return }
        setReady(true)
      } else if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
        if (error) { setErro('Link inválido ou expirado. Solicite um novo.'); return }
        setReady(true)
      } else {
        setErro('Link inválido. Solicite um novo link de recuperação.')
      }
    }
    exchange()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (senha !== confirmar) { toast.error('As senhas não coincidem'); return }
    if (senha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: senha })
    if (error) {
      toast.error(error.message ?? 'Erro ao atualizar senha')
      setLoading(false)
      return
    }
    toast.success('Senha atualizada com sucesso!')
    window.location.href = '/painel'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-pink-50 to-rose-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="font-serif text-3xl font-bold text-rose-400">NailBook</Link>
          <p className="text-gray-500 mt-2 text-sm">Redefinir senha</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {erro ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-red-500">{erro}</p>
              <Link
                href="/painel/recuperar-senha"
                className="inline-block text-sm text-rose-500 font-medium hover:underline"
              >
                Solicitar novo link →
              </Link>
            </div>
          ) : !ready ? (
            <p className="text-center text-sm text-gray-400">Verificando link...</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Nova senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                minLength={6}
                required
              />
              <Input
                label="Confirmar senha"
                type="password"
                placeholder="Digite a senha novamente"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} className="w-full mt-2" size="lg">
                Atualizar senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
