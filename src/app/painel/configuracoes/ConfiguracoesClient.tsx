'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Lock, AlertTriangle, Smartphone, Download, Share, MoreVertical,
  Bell, BellOff, CheckCircle2, FileText, ShieldCheck, FileDown, MessageCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { isPushSupported, subscribeToPush } from '@/lib/push'
import toast from 'react-hot-toast'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

type PushStatus = 'default' | 'granted' | 'denied' | 'unsupported'

export default function ConfiguracoesClient({ email }: { email: string }) {
  const router = useRouter()

  const [enviandoReset, setEnviandoReset] = useState(false)
  const [resetEnviado, setResetEnviado] = useState(false)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const [standalone, setStandalone] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallHint, setShowInstallHint] = useState(false)

  const [pushStatus, setPushStatus] = useState<PushStatus>('default')
  const [ativandoPush, setAtivandoPush] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detecção de modo standalone/permissão só é possível após montar (window/Notification)
    setStandalone(isStandalone())
    setPushStatus(isPushSupported() ? Notification.permission : 'unsupported')

    function handleBeforeInstall(e: Event) {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    function handleInstalled() {
      setStandalone(true)
      setDeferredPrompt(null)
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  async function redefinirSenha() {
    setEnviandoReset(true)
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/painel/nova-senha`,
    })
    setResetEnviado(true)
    setEnviandoReset(false)
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

  async function handleInstalarApp() {
    if (!deferredPrompt) {
      setShowInstallHint(true)
      return
    }
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (choice.outcome === 'accepted') setStandalone(true)
  }

  async function handleAtivarPush() {
    setAtivandoPush(true)
    const ok = await subscribeToPush()
    setAtivandoPush(false)
    setPushStatus(Notification.permission)
    if (!ok && Notification.permission === 'default') {
      toast.error('Não foi possível ativar as notificações')
    }
  }

  function handleExportarDados() {
    toast('Em breve! Estamos trabalhando nessa funcionalidade.', { icon: '🚧' })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Configurações</h1>

      {/* Conta */}
      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <div className="flex items-center justify-between gap-4 pb-4">
            <div className="flex items-start gap-3 min-w-0">
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Senha</p>
                {resetEnviado ? (
                  <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    Link enviado para {email}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Enviaremos um link de redefinição para seu email</p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={redefinirSenha}
              loading={enviandoReset}
              disabled={resetEnviado}
              className="shrink-0"
            >
              Redefinir senha
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 pt-4">
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Excluir conta</p>
                <p className="text-xs text-gray-400 mt-0.5">Apaga todos os seus dados permanentemente</p>
              </div>
            </div>
            <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)} className="shrink-0">
              Excluir conta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aplicativo */}
      <Card>
        <CardHeader>
          <CardTitle>Aplicativo</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <div className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Smartphone className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Instalar app no celular</p>
                  <p className="text-xs text-gray-400 mt-0.5">Acesso rápido e notificações mesmo com o navegador fechado</p>
                </div>
              </div>
              {standalone ? (
                <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Instalado
                </span>
              ) : (
                <Button variant="outline" size="sm" onClick={handleInstalarApp} className="shrink-0">
                  <Download className="w-4 h-4" />
                  Instalar
                </Button>
              )}
            </div>
            {!standalone && showInstallHint && (
              <p className="text-xs text-gray-500 mt-3 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
                {isIos() ? (
                  <>Toque em <Share className="w-3.5 h-3.5 inline -mt-0.5" /> compartilhar → <strong>Adicionar à tela inicial</strong></>
                ) : (
                  <>Abra no Chrome e toque em <MoreVertical className="w-3.5 h-3.5 inline -mt-0.5" /> → <strong>Adicionar à tela inicial</strong></>
                )}
              </p>
            )}
          </div>

          <div className="pt-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <Bell className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">Notificações</p>
                  <p className="text-xs text-gray-400 mt-0.5">Saiba na hora quando alguém agendar</p>
                </div>
              </div>
              {pushStatus === 'granted' && (
                <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  Ativadas
                </span>
              )}
              {pushStatus === 'default' && (
                <Button variant="outline" size="sm" onClick={handleAtivarPush} loading={ativandoPush} className="shrink-0">
                  Ativar notificações
                </Button>
              )}
              {pushStatus === 'denied' && (
                <span className="shrink-0 flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                  <BellOff className="w-4 h-4" />
                  Bloqueadas
                </span>
              )}
            </div>
            {pushStatus === 'denied' && (
              <p className="text-xs text-gray-500 mt-3 leading-relaxed bg-gray-50 rounded-xl px-3 py-2.5">
                As notificações estão bloqueadas para o BelleBook. Para reativar, acesse as configurações de notificação do seu celular ou navegador e permita para este site.
              </p>
            )}
            {pushStatus === 'unsupported' && (
              <p className="text-xs text-gray-400 mt-3">Seu navegador não tem suporte a notificações.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* WhatsApp Automático — prévia da funcionalidade, ainda não existe */}
      <Card className="bg-green-50 border-green-200 opacity-75">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-green-800">WhatsApp Automático</p>
                <span className="shrink-0 text-[10px] font-bold text-white bg-green-800 px-2 py-0.5 rounded-full tracking-wide">
                  EM BREVE
                </span>
              </div>
              <p className="text-xs text-green-700 mt-2 leading-relaxed">
                Em breve você poderá conectar seu WhatsApp ao BelleBook e enviar mensagens automáticas para suas clientes — confirmações de agendamento, lembretes, mensagens de aniversário e muito mais.
              </p>
              <p className="text-xs text-green-700 mt-2 leading-relaxed">
                Estamos desenvolvendo essa funcionalidade para os planos Pro e Studio. Fique de olho nas novidades!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Privacidade e Legal */}
      <Card>
        <CardHeader>
          <CardTitle>Privacidade e Legal</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-gray-100">
          <Link href="/termos" target="_blank" className="flex items-center gap-3 py-3 group">
            <FileText className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm font-medium text-gray-900 group-hover:text-rose-600 transition-colors">Termos de Uso</span>
          </Link>
          <Link href="/privacidade" target="_blank" className="flex items-center gap-3 py-3 group">
            <ShieldCheck className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="text-sm font-medium text-gray-900 group-hover:text-rose-600 transition-colors">Política de Privacidade</span>
          </Link>
          <button onClick={handleExportarDados} className="flex items-center justify-between gap-4 py-3 w-full text-left">
            <div className="flex items-center gap-3 min-w-0">
              <FileDown className="w-5 h-5 text-gray-400 shrink-0" />
              <span className="text-sm font-medium text-gray-900">Exportar meus dados</span>
            </div>
            <span className="shrink-0 text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Em breve</span>
          </button>
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
