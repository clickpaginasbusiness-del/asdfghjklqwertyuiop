-- Feedback periódico da prestadora sobre o BelleBook (modal a cada 7 dias no painel).
create table if not exists feedbacks_prestadora (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  nome_prestadora text not null,
  email_prestadora text not null,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  created_at timestamptz default now()
);

alter table feedbacks_prestadora enable row level security;

-- Prestadora só insere feedback vinculado à própria conta (nome/email vêm
-- do servidor a partir da sessão, não do client — ver /api/feedback).
create policy "Prestadora insere proprio feedback" on feedbacks_prestadora for insert with check (
  exists (select 1 from prestadoras where id = feedbacks_prestadora.prestadora_id and user_id = auth.uid())
);

-- Service role tem acesso total (usado pelo painel admin para listar todos os feedbacks).
create policy "Service role gerencia feedbacks" on feedbacks_prestadora for all using (
  auth.role() = 'service_role'
) with check (
  auth.role() = 'service_role'
);

create index if not exists feedbacks_prestadora_created_idx on feedbacks_prestadora(created_at desc);
