'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { demoToast } from '@/lib/demoData'

export function CalendarioDemoHeader() {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <h1 className="font-serif text-2xl font-semibold text-gray-900">Calendário</h1>
      <Button size="sm" onClick={demoToast}>
        <Plus className="w-4 h-4" />
        Agendar
      </Button>
    </div>
  )
}
