-- Login obrigatório por SMS (Twilio Verify) para clientes que agendam.
-- 1) Tabela de tentativas de OTP para rate-limit por telefone (máx. 3/hora),
--    no mesmo padrão de telefones_usados_trial (acesso só via service role).
-- 2) Coluna verificado_em em clientes, marcada quando o código é confirmado.
-- 3) Remove as policies de INSERT/UPDATE públicas e abertas em agendamentos
--    (criação e cancelamento agora passam por rotas de API que validam o
--    token de sessão do cliente). Leitura pública e UPDATE da prestadora
--    (escopada por auth.uid()) NÃO são alteradas.

create table if not exists otp_tentativas (
  id uuid primary key default uuid_generate_v4(),
  telefone text not null,
  created_at timestamptz default now()
);

create index if not exists idx_otp_tentativas_telefone_created
  on otp_tentativas (telefone, created_at);

alter table otp_tentativas enable row level security;
-- Sem policies: só a service role acessa esta tabela.

alter table clientes
  add column if not exists verificado_em timestamptz;

drop policy if exists "Qualquer um pode criar agendamento" on agendamentos;
drop policy if exists "Cliente pode cancelar proprio agendamento" on agendamentos;
