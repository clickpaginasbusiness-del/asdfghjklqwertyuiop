-- Corrige item importante da auditoria: a checagem de limite_vagas em
-- /api/planos/[id]/assinar/route.ts:39-48 e' um TOCTOU (conta, depois decide)
-- -- mas nem e' ali que a corrida importa de verdade: aquela rota so' gera o
-- LINK de pagamento, a linha em planos_assinaturas so' e' criada/ativada
-- depois, quando o pagamento e' confirmado (criarOuRenovarAssinatura, chamada
-- so' de dentro do webhook do MP). Duas clientes concorrentes podem pagar
-- quase ao mesmo tempo e as duas ativacoes conseguirem passar.
--
-- Em vez de mover a checagem pra JS (mesmo problema, so' que no outro lugar),
-- um trigger BEFORE INSERT/UPDATE com pg_advisory_xact_lock fecha isso sem
-- precisar tocar em criarOuRenovarAssinatura nem nos dois call-sites no
-- webhook -- o lock fica preso a transacao do INSERT/UPDATE em si (que ja e'
-- atomica por natureza vinda do Supabase JS), entao duas ativacoes
-- concorrentes pro mesmo plano_id serializam entre si de verdade.
--
-- Renovacao de quem ja estava 'ativa' nao conta como nova vaga (mesma
-- semantica que ja existia na checagem antiga em JS).

create or replace function checar_limite_vagas_plano() returns trigger as $$
declare
  v_limite integer;
  v_ativas integer;
begin
  if NEW.status != 'ativa' then
    return NEW;
  end if;

  if TG_OP = 'UPDATE' and OLD.status = 'ativa' then
    return NEW;
  end if;

  select limite_vagas into v_limite from planos_prestadora where id = NEW.plano_id;
  if v_limite is null then
    return NEW;
  end if;

  perform pg_advisory_xact_lock(hashtext(NEW.plano_id::text));

  select count(*) into v_ativas
  from planos_assinaturas
  where plano_id = NEW.plano_id and status = 'ativa' and id != NEW.id;

  if v_ativas >= v_limite then
    raise exception 'vagas_esgotadas';
  end if;

  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_checar_limite_vagas on planos_assinaturas;
create trigger trg_checar_limite_vagas
  before insert or update on planos_assinaturas
  for each row execute function checar_limite_vagas_plano();
