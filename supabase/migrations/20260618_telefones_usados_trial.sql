-- Registra telefones que já usaram o trial gratuito, mesmo após a conta ser
-- deletada, para impedir reaproveitamento do período grátis.
CREATE TABLE IF NOT EXISTS telefones_usados_trial (
  id uuid primary key default uuid_generate_v4(),
  telefone text not null unique,
  created_at timestamptz default now()
);

alter table telefones_usados_trial enable row level security;

-- Sem policies: a tabela só é acessada pela service role (admin client),
-- nunca pelo client público.
