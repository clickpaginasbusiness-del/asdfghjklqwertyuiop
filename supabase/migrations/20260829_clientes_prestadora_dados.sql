-- Corrige item critico da auditoria: notas/data_nascimento de clientes eram
-- colunas globais em `clientes` (uma so por telefone, plataforma inteira) --
-- qualquer prestadora com pelo menos um agendamento com aquele telefone
-- conseguia ler E sobrescrever a nota de outra prestadora sem relacao nenhuma
-- com ela. Divide isso numa tabela por prestadora, com RLS de verdade.

create table clientes_prestadora_dados (
  id uuid primary key default uuid_generate_v4(),
  cliente_id uuid references clientes(id) on delete cascade not null,
  prestadora_id uuid references prestadoras(id) on delete cascade not null,
  notas text,
  data_nascimento date,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (cliente_id, prestadora_id)
);

alter table clientes_prestadora_dados enable row level security;

create policy "Prestadora gerencia proprios dados de cliente" on clientes_prestadora_dados
  for all using (
    exists (select 1 from prestadoras where id = clientes_prestadora_dados.prestadora_id and user_id = auth.uid())
  );

create policy "Service role manage clientes_prestadora_dados" on clientes_prestadora_dados
  for all using (auth.role() = 'service_role');

create index idx_clientes_prestadora_dados_prestadora on clientes_prestadora_dados(prestadora_id);

-- Migracao do historico bagunçado: nao ha coluna nenhuma registrando quem
-- escreveu a nota original, entao nao da pra restaurar "o autor de verdade".
-- Estrategia escolhida (opcao C, decidida em conjunto): atribui a nota/data
-- de nascimento existente so a prestadora do agendamento MAIS RECENTE com
-- aquela cliente -- aposta em quem provavelmente ainda atende essa cliente
-- hoje. Todas as outras prestadoras que compartilhavam a mesma cliente
-- comecam com a ficha zerada a partir de agora, sem herdar nada.
insert into clientes_prestadora_dados (cliente_id, prestadora_id, notas, data_nascimento)
select c.id, ranked.prestadora_id, c.notas, c.data_nascimento
from clientes c
join lateral (
  select a.prestadora_id
  from agendamentos a
  where a.cliente_id = c.id
  order by a.data_hora desc
  limit 1
) ranked on true
where c.notas is not null or c.data_nascimento is not null;

-- As colunas antigas em `clientes` ficam por enquanto (nao apagar ainda) --
-- so remover numa migracao separada depois de confirmar que nenhum codigo
-- le/escreve mais nelas (ver PATCH /api/clientes/[id], POST /api/clientes/
-- manual, e as leituras em painel/clientes, painel/calendario, painel/
-- agendamentos e painel/page.tsx, todas atualizadas nesta mesma leva).
