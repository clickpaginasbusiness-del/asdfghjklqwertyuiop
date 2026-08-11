'use client'

import { useState, type RefObject } from 'react'
import { Download, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NOMES_MESES } from '@/lib/retrospectiva'
import toast from 'react-hot-toast'

/** Baixar imagem + compartilhar — usado tanto no modal automático quanto na
 * lista de retrospectivas antigas em /painel/perfil. */
export function RetrospectivaAcoes({
  cardRef, mes, ano,
}: {
  cardRef: RefObject<HTMLDivElement | null>
  mes: number
  ano: number
}) {
  const [baixando, setBaixando] = useState(false)
  const nomeMes = NOMES_MESES[mes - 1]

  async function baixarImagem() {
    if (!cardRef.current) return
    setBaixando(true)
    try {
      // Garante que a Playfair Display (título do card) já terminou de
      // carregar antes de capturar — sem isso o html2canvas às vezes
      // rasteriza com a fonte de fallback, principalmente no primeiro
      // carregamento da página. Lê o font-family JÁ COMPUTADO no elemento
      // (em vez de supor o nome "cru" da Google Font) porque o next/font
      // pode registrar a fonte self-hosted sob um nome diferente.
      await document.fonts.ready
      const alvo = cardRef.current.querySelector('h1') ?? cardRef.current
      const fontFamily = getComputedStyle(alvo).fontFamily
      await document.fonts.load(`700 32px ${fontFamily}`).catch(() => {})

      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        backgroundColor: null,
        scale: 2,
      })

      const link = document.createElement('a')
      link.download = `retrospectiva-${nomeMes.toLowerCase()}-${ano}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('[retrospectiva] erro ao gerar imagem', err)
      toast.error('Não foi possível gerar a imagem. Tente novamente.')
    } finally {
      setBaixando(false)
    }
  }

  function compartilharWhatsapp() {
    // A imagem em si não vai pelo link — limitação do WhatsApp (só dá pra
    // pré-preencher texto via URL, nunca um arquivo). O texto já incentiva a
    // pessoa a anexar a imagem baixada na hora de mandar.
    const texto = `Minha retrospectiva de ${nomeMes} no BelleBook! 💅`
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2.5 w-full">
      <Button onClick={baixarImagem} loading={baixando} className="flex-1 gap-1.5">
        <Download className="w-4 h-4" />
        Baixar imagem
      </Button>
      <Button onClick={compartilharWhatsapp} variant="outline" className="flex-1 gap-1.5">
        <MessageCircle className="w-4 h-4" />
        Compartilhar
      </Button>
    </div>
  )
}
