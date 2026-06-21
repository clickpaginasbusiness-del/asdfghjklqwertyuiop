-- Login de clientes passa a ser telefone + senha (OTP só no cadastro e na
-- recuperação de senha). Adiciona senha_hash (bcrypt) e tabela de rate-limit
-- de tentativas de login.
--
-- A tabela clientes tinha policies públicas abertas (select/insert "true"),
-- o que exporia senha_hash para qualquer um com a anon key. Substituímos por
-- uma policy escopada (prestadora só lê clientes com quem já tem
-- agendamento — usada hoje pelo painel/relatórios/realtime da prestadora) e
-- revogamos a coluna senha_hash de anon/authenticated como defesa extra.

alter table clientes
  add column if not exists senha_hash text;

create table if not exists login_tentativas (
  id uuid primary key default uuid_generate_v4(),
  telefone text not null,
  created_at timestamptz default now()
);

create index if not exists idx_login_tentativas_telefone_created
  on login_tentativas (telefone, created_at);

alter table login_tentativas enable row level security;
-- Sem policies: só a service role acessa esta tabela.

drop policy if exists "Clientes podem ser criados por qualquer um" on clientes;
drop policy if exists "Clientes publicos para leitura autenticada" on clientes;

create policy "Prestadora le clientes com agendamento" on clientes for select using (
  exists (
    select 1 from agendamentos a
    join prestadoras p on p.id = a.prestadora_id
    where a.cliente_id = clientes.id and p.user_id = auth.uid()
  )
);

revoke select (senha_hash) on clientes from anon, authenticated;
