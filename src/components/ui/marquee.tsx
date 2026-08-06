import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MarqueeProps {
  className?: string
  reverse?: boolean
  pauseOnHover?: boolean
  children: ReactNode
}

export function Marquee({ className, reverse = false, pauseOnHover = false, children }: MarqueeProps) {
  return (
    <div className={cn('flex overflow-hidden', pauseOnHover && 'marquee-pause-on-hover', className)}>
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className={cn('flex shrink-0 items-stretch gap-6 pr-6', reverse ? 'animate-marquee-reverse' : 'animate-marquee')}
        >
          {children}
        </div>
      ))}
    </div>
  )
}
