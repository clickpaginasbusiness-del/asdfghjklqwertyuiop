-- Visitas a pagina publica (para relatorios de conversao)
create table if not exists visitas_pagina (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  created_at timestamptz default now()
);

alter table visitas_pagina enable row level security;

create policy "Qualquer um pode criar visita" on visitas_pagina
  for insert with check (true);

create policy "Prestadora le proprias visitas" on visitas_pagina
  for select using (
    exists (select 1 from prestadoras where id = visitas_pagina.prestadora_id and user_id = auth.uid())
  );

create index if not exists visitas_pagina_prestadora_idx on visitas_pagina(prestadora_id, created_at);
