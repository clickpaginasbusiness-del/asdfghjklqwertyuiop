import { Capacitor } from '@capacitor/core'

/**
 * True quando o app já está rodando "instalado" — app nativo empacotado via
 * Capacitor (Android/iOS) OU PWA instalada pelo navegador (display-mode:
 * standalone no Android/desktop, navigator.standalone no iOS Safari). Nenhum
 * desses três sinais detecta os outros dois sozinho — a WebView do Capacitor,
 * por exemplo, não reporta display-mode: standalone — por isso os três juntos
 * aqui em vez de cada tela reimplementar (e esquecer) uma parte da checagem.
 */
export function isInstalledApp(): boolean {
  if (typeof window === 'undefined') return false

  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
