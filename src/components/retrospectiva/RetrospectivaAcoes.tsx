'use client'

import { useEffect, useState, type RefObject } from 'react'
import { Download, MessageCircle, AtSign, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NOMES_MESES } from '@/lib/retrospectiva'
import toast from 'react-hot-toast'

type Acao = 'baixar' | 'whatsapp' | 'instagram' | 'compartilhar' | null

/**
 * Captura o card em um Blob PNG — usado por todas as ações (baixar, copiar,
 * compartilhar nativo). Um único ponto faz: esperar fontes carregarem,
 * esperar imagens (foto de perfil) terminarem de decodificar, e só então
 * rodar o html2canvas — cada etapa é uma causa real e comum de imagem em
 * branco/cortada se pulada.
 */
async function capturarCard(cardEl: HTMLDivElement): Promise<Blob> {
  // Playfair Display (título/número grande do card) — sem isso o
  // html2canvas às vezes rasteriza com a fonte de fallback, principalmente
  // no primeiro carregamento da página. Lê o font-family JÁ COMPUTADO no
  // elemento (não supõe o nome "cru" da Google Font) porque o next/font
  // pode registrar a fonte self-hosted sob um nome diferente.
  await document.fonts.ready
  const alvo = cardEl.querySelector('h1, [data-numero-grande]') ?? cardEl
  const fontFamily = getComputedStyle(alvo).fontFamily
  await document.fonts.load(`700 32px ${fontFamily}`).catch(() => {})

  // Foto de perfil (se houver) — espera decodificar antes de capturar,
  // senão o html2canvas pode rodar antes da imagem estar pronta e o card
  // sai com um círculo em branco no lugar da foto.
  const imgs = Array.from(cardEl.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) => (img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        })
    ))
  )

  // html2canvas-pro (não o html2canvas puro) — o Tailwind v4 gera cores em
  // oklch() por padrão, e o html2canvas 1.4.1 não sabe parsear esse formato
  // (lança "Attempting to parse an unsupported color function"). Esse fork
  // é mantido justamente pra suportar oklch()/lab()/color-mix().
  const html2canvas = (await import('html2canvas-pro')).default
  const canvas = await html2canvas(cardEl, {
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    scale: 2,
  })

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('canvas.toBlob() retornou null'))
    }, 'image/png')
  })
}

function logErro(acao: string, err: unknown) {
  console.error(
    `[retrospectiva] falha em "${acao}":`,
    err instanceof Error ? `${err.name}: ${err.message}` : err,
    err instanceof Error ? err.stack : undefined
  )
}

/** Baixar imagem + compartilhar — usado tanto no modal automático quanto na
 * lista de retrospectivas antigas em /painel/perfil. */
export function RetrospectivaAcoes({
  cardRef, mes, ano,
}: {
  cardRef: RefObject<HTMLDivElement | null>
  mes: number
  ano: number
}) {
  const [carregando, setCarregando] = useState<Acao>(null)
  const [compartilhamentoNativo, setCompartilhamentoNativo] = useState(false)
  const nomeMes = NOMES_MESES[mes - 1]

  useEffect(() => {
    // Checagem barata só de presença da API — a checagem de verdade se dá
    // conta arquivos de imagem (canShare({ files })) roda no clique, com o
    // Blob já em mãos.
    setCompartilhamentoNativo(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  function nomeArquivo() {
    return `retrospectiva-${nomeMes.toLowerCase()}-${ano}.png`
  }

  async function baixarImagem() {
    if (!cardRef.current) {
      console.error('[retrospectiva] baixarImagem: cardRef.current é nulo — card não está montado')
      toast.error('Não foi possível gerar a imagem. Tente novamente.')
      return
    }
    setCarregando('baixar')
    try {
      const blob = await capturarCard(cardRef.current)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.download = nomeArquivo()
      link.href = url
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      logErro('baixar imagem', err)
      toast.error('Não foi possível gerar a imagem. Tente novamente.')
    } finally {
      setCarregando(null)
    }
  }

  function compartilharWhatsapp() {
    // A imagem em si não vai pelo link — limitação do WhatsApp (só dá pra
    // pré-preencher texto via URL, nunca um arquivo). O texto já incentiva a
    // pessoa a anexar a imagem baixada na hora de mandar.
    const texto = `Minha retrospectiva de ${nomeMes} no BelleBook! 💅`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  async function copiarParaInstagram() {
    if (!cardRef.current) {
      console.error('[retrospectiva] copiarParaInstagram: cardRef.current é nulo — card não está montado')
      toast.error('Não foi possível copiar a imagem. Tente novamente.')
      return
    }
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      toast.error('Seu navegador não permite copiar imagens. Use "Baixar" e anexe manualmente.')
      return
    }
    const cardEl = cardRef.current
    setCarregando('instagram')
    try {
      // Passa uma Promise pro ClipboardItem em vez de esperar o Blob antes
      // de chamar write() — a chamada em si roda na hora, ainda dentro do
      // gesto de clique; só o CONTEÚDO resolve depois. Sem isso, navegadores
      // mais estritos (Safari) recusam por não reconhecerem mais o clique
      // como gesto válido depois de um await.
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': capturarCard(cardEl) }),
      ])
      toast.success('Imagem copiada! Cole no Instagram Stories 📸')
    } catch (err) {
      logErro('copiar pra Instagram', err)
      toast.error('Não foi possível copiar a imagem. Tente "Baixar" em vez disso.')
    } finally {
      setCarregando(null)
    }
  }

  async function compartilharNativo() {
    if (!cardRef.current) {
      console.error('[retrospectiva] compartilharNativo: cardRef.current é nulo — card não está montado')
      toast.error('Não foi possível compartilhar. Tente novamente.')
      return
    }
    setCarregando('compartilhar')
    try {
      const blob = await capturarCard(cardRef.current)
      const file = new File([blob], nomeArquivo(), { type: 'image/png' })

      if (!navigator.canShare?.({ files: [file] })) {
        toast.error('Esse dispositivo não aceita compartilhar imagens. Use "Baixar" em vez disso.')
        return
      }

      await navigator.share({
        files: [file],
        title: 'Minha Retrospectiva BelleBook',
        text: `Minha retrospectiva de ${nomeMes} no BelleBook! 💅`,
      })
    } catch (err) {
      // Usuária cancelou o share sheet — não é erro de verdade.
      if (err instanceof Error && err.name === 'AbortError') return
      logErro('compartilhar nativo', err)
      toast.error('Não foi possível compartilhar. Tente "Baixar" em vez disso.')
    } finally {
      setCarregando(null)
    }
  }

  return (
    <div className="w-full space-y-2.5">
      {compartilhamentoNativo && (
        <Button onClick={compartilharNativo} loading={carregando === 'compartilhar'} className="w-full gap-1.5">
          <Share2 className="w-4 h-4" />
          Compartilhar
        </Button>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Button
          onClick={baixarImagem}
          loading={carregando === 'baixar'}
          variant="outline"
          className="flex-col gap-1 py-2.5 px-1 text-xs"
        >
          <Download className="w-4 h-4" />
          Baixar
        </Button>
        <Button
          onClick={compartilharWhatsapp}
          variant="outline"
          className="flex-col gap-1 py-2.5 px-1 text-xs"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </Button>
        <Button
          onClick={copiarParaInstagram}
          loading={carregando === 'instagram'}
          variant="outline"
          className="flex-col gap-1 py-2.5 px-1 text-xs"
        >
          <AtSign className="w-4 h-4" />
          Instagram
        </Button>
      </div>
    </div>
  )
}
