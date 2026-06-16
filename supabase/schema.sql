-- NailBook Database Schema

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Prestadoras (Nail Designers)
create table if not exists prestadoras (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade unique,
  nome text not null,
  email text not null unique,
  slug text not null unique,
  bio text,
  foto_url text,
  hora_abertura time not null default '09:00',
  hora_fechamento time not null default '18:00',
  created_at timestamptz default now()
);

-- Profissionais (equipe da prestadora)
create table if not exists profissionais (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  nome text not null,
  foto_url text,
  bio text,
  ativa boolean default true,
  created_at timestamptz default now()
);

-- Servicos
create table if not exists servicos (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  nome text not null,
  preco numeric(10,2) not null,
  duracao_minutos int not null,
  descricao text,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Clientes
create table if not exists clientes (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  telefone text not null unique,
  created_at timestamptz default now()
);

-- Agendamentos
create table if not exists agendamentos (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  profissional_id uuid references profissionais(id) on delete set null,
  servico_id uuid references servicos(id) on delete cascade not null,
  cliente_id uuid references clientes(id) on delete cascade not null,
  data_hora timestamptz not null,
  status text not null default 'confirmado' check (status in ('confirmado', 'cancelado', 'concluido')),
  created_at timestamptz default now()
);

-- Galeria
create table if not exists galeria (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  url text not null,
  tipo text not null default 'imagem' check (tipo in ('imagem', 'video')),
  created_at timestamptz default now()
);

-- Dias Bloqueados
create table if not exists dias_bloqueados (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  data date not null,
  motivo text,
  unique(prestadora_id, data)
);

-- Notificacoes
create table if not exists notificacoes (
  id uuid primary key default uuid_generate_v4(),
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  mensagem text not null,
  lida boolean default false,
  tipo text default 'agendamento' check (tipo in ('agendamento', 'cancelamento')),
  created_at timestamptz default now()
);

-- Row Level Security
alter table prestadoras enable row level security;
alter table profissionais enable row level security;
alter table servicos enable row level security;
alter table clientes enable row level security;
alter table agendamentos enable row level security;
alter table galeria enable row level security;
alter table dias_bloqueados enable row level security;
alter table notificacoes enable row level security;

-- Policies: Prestadoras
create policy "Prestadoras publicas para leitura" on prestadoras for select using (true);
create policy "Prestadora gerencia proprio perfil" on prestadoras for all using (auth.uid() = user_id);

-- Policies: Profissionais
create policy "Profissionais publicas para leitura" on profissionais for select using (true);
create policy "Prestadora gerencia proprias profissionais" on profissionais for all using (
  exists (select 1 from prestadoras where id = profissionais.prestadora_id and user_id = auth.uid())
);

-- Policies: Servicos
create policy "Servicos publicos para leitura" on servicos for select using (true);
create policy "Prestadora gerencia proprios servicos" on servicos for all using (
  exists (select 1 from prestadoras where id = servicos.prestadora_id and user_id = auth.uid())
);
create policy "Service role manage servicos" on servicos for all using (auth.role() = 'service_role');

-- Policies: Clientes
create policy "Clientes podem ser criados por qualquer um" on clientes for insert with check (true);
create policy "Clientes publicos para leitura autenticada" on clientes for select using (true);
create policy "Service role manage clientes" on clientes for all using (auth.role() = 'service_role');

-- Policies: Agendamentos
create policy "Agendamentos publicos para leitura" on agendamentos for select using (true);
create policy "Qualquer um pode criar agendamento" on agendamentos for insert with check (true);
create policy "Prestadora gerencia proprios agendamentos" on agendamentos for update using (
  exists (select 1 from prestadoras where id = agendamentos.prestadora_id and user_id = auth.uid())
);
create policy "Cliente pode cancelar proprio agendamento" on agendamentos for update using (true);

-- Policies: Galeria
create policy "Galeria publica para leitura" on galeria for select using (true);
create policy "Prestadora gerencia propria galeria" on galeria for all using (
  exists (select 1 from prestadoras where id = galeria.prestadora_id and user_id = auth.uid())
);

-- Policies: Dias Bloqueados
create policy "Dias bloqueados publicos para leitura" on dias_bloqueados for select using (true);
create policy "Prestadora gerencia proprios dias bloqueados" on dias_bloqueados for all using (
  exists (select 1 from prestadoras where id = dias_bloqueados.prestadora_id and user_id = auth.uid())
);

-- Policies: Notificacoes
create policy "Prestadora le proprias notificacoes" on notificacoes for select using (
  exists (select 1 from prestadoras where id = notificacoes.prestadora_id and user_id = auth.uid())
);
create policy "Sistema cria notificacoes" on notificacoes for insert with check (true);
create policy "Prestadora atualiza proprias notificacoes" on notificacoes for update using (
  exists (select 1 from prestadoras where id = notificacoes.prestadora_id and user_id = auth.uid())
);
create policy "Prestadora deleta proprias notificacoes" on notificacoes for delete using (
  exists (select 1 from prestadoras where id = notificacoes.prestadora_id and user_id = auth.uid())
);

-- Enable Realtime
alter publication supabase_realtime add table agendamentos;
alter publication supabase_realtime add table notificacoes;

-- Storage bucket for gallery, avatars and profissionais
insert into storage.buckets (id, name, public) values ('galeria', 'galeria', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('profissionais', 'profissionais', true) on conflict do nothing;

-- Storage policies
create policy "Galeria publica" on storage.objects for select using (bucket_id = 'galeria');
create policy "Autenticado faz upload galeria" on storage.objects for insert with check (bucket_id = 'galeria' and auth.role() = 'authenticated');
create policy "Autenticado deleta galeria" on storage.objects for delete using (bucket_id = 'galeria' and auth.role() = 'authenticated');
create policy "Avatar publico" on storage.objects for select using (bucket_id = 'avatars');
create policy "Autenticado faz upload avatar" on storage.objects for insert with check (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Autenticado atualiza avatar" on storage.objects for update using (bucket_id = 'avatars' and auth.role() = 'authenticated');
create policy "Profissional foto publica" on storage.objects for select using (bucket_id = 'profissionais');
create policy "Autenticado faz upload profissional" on storage.objects for insert with check (bucket_id = 'profissionais' and auth.role() = 'authenticated');
create policy "Autenticado atualiza profissional" on storage.objects for update using (bucket_id = 'profissionais' and auth.role() = 'authenticated');
create policy "Autenticado deleta profissional" on storage.objects for delete using (bucket_id = 'profissionais' and auth.role() = 'authenticated');
