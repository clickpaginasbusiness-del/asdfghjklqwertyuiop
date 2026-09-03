-- Corrige item critico da auditoria: double-booking real. A checagem de
-- sobreposicao de horario em criar/route.ts, criar-pendente/route.ts e
-- criar-manual/route.ts fazia SELECT (conflitos) e so DEPOIS o INSERT, em
-- dois passos separados sem lock nenhum -- duas reservas concorrentes pro
-- mesmo profissional/horario podiam passar na checagem ao mesmo tempo e
-- ambas conseguirem a vaga. Alem disso, a checagem so considerava
-- agendamentos 'confirmado', nunca 'aguardando_pagamento' -- reservas
-- pendentes de pagamento de OUTRAS clientes nao bloqueavam nada.
--
-- Move checagem + insert pra dentro de uma unica funcao no banco, com
-- pg_advisory_xact_lock serializando tentativas concorrentes pra mesma
-- prestadora -- garante atomicidade real, mesmo espirito do compare-and-swap
-- ja usado em aplicarUsoCredito (planosPrestadora.ts). Os tres pontos de
-- insert (criar, criar-pendente, criar-manual) passam a chamar essa funcao
-- via .rpc() em vez de fazer select-depois-insert em JS.
--
-- Replica EXATAMENTE a regra ja existente pra profissional_id nulo ("sem
-- profissional especifico" -> conflito checado contra QUALQUER profissional
-- da prestadora): quando p_profissional_id e' null, a condicao de match
-- ignora profissional_id da linha existente; quando nao e' null, so compara
-- contra linhas com o MESMO profissional_id (linhas com profissional_id null
-- nunca "batem" contra um p_profissional_id especifico -- mesma assimetria
-- que ja existia no codigo em JS, nao e' bug novo, so preservando).

create or replace function criar_agendamento_seguro(
  p_prestadora_id uuid,
  p_profissional_id uuid,
  p_servico_id uuid,
  p_cliente_id uuid,
  p_data_hora timestamptz,
  p_status text,
  p_plano_assinatura_id uuid default null,
  p_tipo_pagamento text default null,
  p_agendamento_manual boolean default false,
  p_cliente_e_prestadora boolean default false
)
returns agendamentos
language plpgsql
as $$
declare
  v_duracao integer;
  v_novo_fim timestamptz;
  v_inicio_dia timestamptz;
  v_fim_dia timestamptz;
  v_conflito boolean;
  v_novo agendamentos;
begin
  -- Serializa TODA tentativa de agendar pra essa prestadora (nao so pro
  -- mesmo profissional) -- mais simples e mais seguro que tentar separar
  -- locks por profissional, dado que "sem profissional especifico" ja
  -- conflita contra todos. Custo de contencao irrelevante pro volume real
  -- de agendamentos de um salao.
  perform pg_advisory_xact_lock(hashtext(p_prestadora_id::text)::bigint);

  select duracao_minutos into v_duracao from servicos where id = p_servico_id;
  if v_duracao is null then
    raise exception 'servico_nao_encontrado';
  end if;

  v_novo_fim := p_data_hora + (v_duracao || ' minutes')::interval;
  v_inicio_dia := date_trunc('day', p_data_hora);
  v_fim_dia := v_inicio_dia + interval '1 day';

  select exists (
    select 1
    from agendamentos a
    join servicos s on s.id = a.servico_id
    where a.prestadora_id = p_prestadora_id
      and a.status in ('confirmado', 'aguardando_pagamento')
      and a.data_hora >= v_inicio_dia
      and a.data_hora < v_fim_dia
      and (p_profissional_id is null or a.profissional_id = p_profissional_id)
      and p_data_hora < (a.data_hora + (s.duracao_minutos || ' minutes')::interval)
      and v_novo_fim > a.data_hora
  ) into v_conflito;

  if v_conflito then
    raise exception 'horario_conflitante';
  end if;

  insert into agendamentos (
    prestadora_id, profissional_id, servico_id, cliente_id, data_hora, status,
    plano_assinatura_id, tipo_pagamento, agendamento_manual, cliente_e_prestadora
  ) values (
    p_prestadora_id, p_profissional_id, p_servico_id, p_cliente_id, p_data_hora, p_status,
    p_plano_assinatura_id, p_tipo_pagamento, p_agendamento_manual, p_cliente_e_prestadora
  )
  returning * into v_novo;

  return v_novo;
end;
$$;
