'use client'

import { useEffect } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

interface Props {
  prestadoraId: string
  onOpenSidebar: () => void
  onCloseSidebar: () => void
}

function tourKey(prestadoraId: string) {
  return `bb_onboarding_done_${prestadoraId}`
}

export function OnboardingTour({ prestadoraId, onOpenSidebar, onCloseSidebar }: Props) {
  useEffect(() => {
    if (localStorage.getItem(tourKey(prestadoraId))) return

    onOpenSidebar()

    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Próximo',
        prevBtnText: 'Voltar',
        doneBtnText: 'Concluir',
        onPopoverRender: (popover) => {
          const skipBtn = document.createElement('button')
          skipBtn.innerText = 'Pular tour'
          skipBtn.className = 'bb-tour-skip-btn'
          skipBtn.addEventListener('click', () => driverObj.destroy())
          popover.footer.prepend(skipBtn)
        },
        onDestroyed: () => {
          localStorage.setItem(tourKey(prestadoraId), '1')
          onCloseSidebar()
          window.dispatchEvent(new Event('bb-onboarding-done'))
        },
        steps: [
          {
            popover: {
              title: 'Bem-vinda ao BelleBook! 🌸',
              description: 'Vamos te mostrar o básico em 1 minuto.',
            },
          },
          {
            element: '[data-tour="tour-servicos"]',
            popover: {
              title: 'Seus serviços',
              description: 'Comece adicionando seus serviços e preços.',
              side: 'right',
            },
          },
          {
            element: '[data-tour="tour-perfil"]',
            popover: {
              title: 'Meu Perfil',
              description: 'Configure seu perfil e link público.',
              side: 'right',
            },
          },
          {
            element: '[data-tour="tour-horarios"]',
            popover: {
              title: 'Horários',
              description: 'Defina seus dias e horários de atendimento.',
              side: 'right',
            },
          },
          {
            element: '[data-tour="tour-link-publico"]',
            popover: {
              title: 'Seu link público',
              description: 'Compartilhe esse link com suas clientes.',
              side: 'right',
            },
          },
          {
            element: '[data-tour="tour-assinatura"]',
            popover: {
              title: 'Assinatura',
              description: 'Explore os planos quando o trial acabar.',
              side: 'right',
            },
          },
        ],
      })

      driverObj.drive()
    }, 400)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prestadoraId])

  return null
}
