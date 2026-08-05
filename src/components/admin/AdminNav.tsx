'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const ITEMS = [
  { href: '/admin', label: 'Visão geral' },
  { href: '/admin/parceiras', label: 'Parceiras' },
  { href: '/admin/saques', label: 'Saques' },
  { href: '/admin/saques-caixa', label: 'Saques Caixa' },
  { href: '/admin/cupons', label: 'Cupons' },
  { href: '/admin/financeiro', label: 'Financeiro' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const active = item.href === '/admin'
          ? pathname === '/admin'
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              active ? 'bg-rose-50 text-rose-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
