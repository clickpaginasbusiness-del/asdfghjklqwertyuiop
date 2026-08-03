/** Validação de arquivo antes do upload pro Storage — nem o código nem os
 * buckets do Supabase (`galeria`, `avatars`, `profissionais`) tinham
 * nenhum limite de tipo/tamanho antes disso (achado da auditoria de
 * segurança: qualquer conta autenticada podia subir arquivo de qualquer
 * tipo/tamanho). O atributo `accept` do `<input type="file">` é só uma
 * sugestão de UI pro seletor do SO — não bloqueia nada de verdade, por
 * isso a validação real precisa acontecer aqui antes do `.upload()`. */

export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const TIPOS_VIDEO = ['video/mp4']

export const MAX_TAMANHO_FOTO = 10 * 1024 * 1024 // 10MB
export const MAX_TAMANHO_VIDEO = 50 * 1024 * 1024 // 50MB

/** Retorna a mensagem de erro se o arquivo for inválido, ou `null` se estiver ok. */
export function validarArquivo(file: File, { aceitarVideo = false }: { aceitarVideo?: boolean } = {}): string | null {
  const tiposValidos = aceitarVideo ? [...TIPOS_IMAGEM, ...TIPOS_VIDEO] : TIPOS_IMAGEM

  if (!tiposValidos.includes(file.type)) {
    return aceitarVideo
      ? `Formato não suportado (${file.name}). Use JPEG, PNG, WEBP, GIF ou MP4.`
      : `Formato não suportado (${file.name}). Use JPEG, PNG, WEBP ou GIF.`
  }

  const ehVideo = file.type.startsWith('video/')
  const maxTamanho = ehVideo ? MAX_TAMANHO_VIDEO : MAX_TAMANHO_FOTO
  if (file.size > maxTamanho) {
    const maxLabel = ehVideo ? '50MB' : '10MB'
    return `${file.name} é maior que o limite de ${maxLabel}.`
  }

  return null
}
