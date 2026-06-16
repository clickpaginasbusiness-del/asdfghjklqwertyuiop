-- Migration: adicionar suporte a múltiplos profissionais
-- Execute este arquivo se você já rodou o schema.sql original

-- Nova tabela profissionais
create table if not exists profissionais (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  nome text not null,
  foto_url text,
  bio text,
  ativa boolean default true,
  created_at timestamptz default now()
);

-- RLS
alter table profissionais enable row level security;

create policy "Profissionais publicas para leitura" on profissionais for select using (true);
create policy "Prestadora gerencia proprias profissionais" on profissionais for all using (
  exists (select 1 from prestadoras where id = profissionais.prestadora_id and user_id = auth.uid())
);

-- Adicionar profissional_id em agendamentos
alter table agendamentos
  add column if not exists profissional_id uuid references profissionais(id) on delete set null;

-- Storage bucket para fotos das profissionais
insert into storage.buckets (id, name, public) values ('profissionais', 'profissionais', true) on conflict do nothing;

create policy "Profissional foto publica" on storage.objects for select using (bucket_id = 'profissionais');
create policy "Autenticado faz upload profissional" on storage.objects for insert with check (bucket_id = 'profissionais' and auth.role() = 'authenticated');
create policy "Autenticado atualiza profissional" on storage.objects for update using (bucket_id = 'profissionais' and auth.role() = 'authenticated');
create policy "Autenticado deleta profissional" on storage.objects for delete using (bucket_id = 'profissionais' and auth.role() = 'authenticated');
