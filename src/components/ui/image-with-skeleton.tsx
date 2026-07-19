'use client'

import { useState } from 'react'
import Image, { type ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

/**
 * Wrapper de next/image que mostra um skeleton pulsante enquanto a imagem
 * carrega, em vez da caixa cinza sólida e vazia do fill color padrão.
 */
export function ImageWithSkeleton({ className, onLoad, src, alt, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false)
  const [prevSrc, setPrevSrc] = useState(src)

  if (src !== prevSrc) {
    setPrevSrc(src)
    setLoaded(false)
  }

  return (
    <div className="relative w-full h-full">
      {!loaded && <div className="absolute inset-0 bg-gray-200 animate-pulse" aria-hidden="true" />}
      <Image
        src={src}
        alt={alt}
        className={cn('transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0', className)}
        onLoad={(e) => {
          setLoaded(true)
          onLoad?.(e)
        }}
        {...props}
      />
    </div>
  )
}
