-- FCM (push nativo, app Capacitor): tokens de dispositivo da prestadora, em
-- paralelo a push_subscriptions (Web Push/VAPID) — os dois canais coexistem.
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  token text not null unique,
  user_agent text,
  created_at timestamptz default now()
);

alter table fcm_tokens enable row level security;

create policy "Prestadora gerencia proprios fcm_tokens" on fcm_tokens for all using (
  exists (select 1 from prestadoras where id = fcm_tokens.prestadora_id and user_id = auth.uid())
);
create policy "Service role manage fcm_tokens" on fcm_tokens for all using (auth.role() = 'service_role');
