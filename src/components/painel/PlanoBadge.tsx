export function PlanoBadge({ nome }: { nome: string }) {
  return (
    <span className="ml-1.5 inline-flex items-center bg-emerald-100 text-emerald-700 rounded-full px-1.5 py-0.5 text-[10px] font-semibold align-middle">
      Plano {nome}
    </span>
  )
}
