-- Web Push: inscrições de notificação push da prestadora (um registro por dispositivo/navegador)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Prestadora gerencia proprias push_subscriptions" on push_subscriptions for all using (
  exists (select 1 from prestadoras where id = push_subscriptions.prestadora_id and user_id = auth.uid())
);
create policy "Service role manage push_subscriptions" on push_subscriptions for all using (auth.role() = 'service_role');
