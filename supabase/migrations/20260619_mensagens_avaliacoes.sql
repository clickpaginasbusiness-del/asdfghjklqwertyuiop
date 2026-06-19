-- Templates de mensagens de WhatsApp personalizáveis (Meu Perfil > Mensagens de WhatsApp)
ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS mensagem_confirmacao text,
  ADD COLUMN IF NOT EXISTS mensagem_cancelamento text,
  ADD COLUMN IF NOT EXISTS mensagem_lembrete text;

-- Avaliações das clientes sobre o atendimento
CREATE TABLE IF NOT EXISTS avaliacoes (
  id uuid primary key default uuid_generate_v4(),
  agendamento_id uuid references agendamentos(id) on delete cascade not null unique,
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  created_at timestamptz default now()
);

alter table avaliacoes enable row level security;

create policy "Avaliacoes publicas para leitura" on avaliacoes for select using (true);
create policy "Cliente pode criar avaliacao" on avaliacoes for insert with check (true);
