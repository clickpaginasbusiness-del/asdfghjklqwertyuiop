import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function LegalLayout({
  title,
  vigencia,
  children,
}: {
  title: string
  vigencia: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <header className="max-w-3xl mx-auto px-6 pt-10 pb-6">
        <Link href="/" className="font-serif text-2xl font-bold text-rose-400">BelleBook</Link>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o início
        </Link>
      </header>

      <main className="max-w-3xl mx-auto px-6 pb-24">
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-gray-900 leading-tight">{title}</h1>
        <p className="text-sm text-gray-400 mt-3">Vigência a partir de {vigencia}</p>

        <div className="prose-legal mt-10 space-y-8 text-gray-600 leading-relaxed">
          {children}
        </div>
      </main>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      <div className="space-y-3 text-sm sm:text-base">{children}</div>
    </section>
  )
}
