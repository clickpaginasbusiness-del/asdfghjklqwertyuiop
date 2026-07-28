-- Marca agendamentos em que a cliente é a própria prestadora testando o
-- sistema (telefone do cliente == telefone da prestadora). Não bloqueia o
-- agendamento — só sinaliza visualmente no painel ("(Você)") e, quando o
-- sistema de missões/objetivos existir, esses agendamentos (e avaliações
-- feitas por essa cliente) não devem contar para nenhuma missão.
ALTER TABLE agendamentos
  ADD COLUMN IF NOT EXISTS cliente_e_prestadora boolean DEFAULT false;

-- Backfill: sinaliza agendamentos já existentes cujo telefone já bate.
-- clientes.telefone é só dígitos locais (DDD+número); prestadoras.telefone
-- é E.164 (+55DDD+número) — normaliza os dois pro mesmo formato antes de
-- comparar (mesma lógica usada em /api/agendamentos/criar).
UPDATE agendamentos a
SET cliente_e_prestadora = true
FROM clientes c
JOIN prestadoras p ON p.id = a.prestadora_id
WHERE a.cliente_id = c.id
  AND a.cliente_e_prestadora = false
  AND p.telefone IS NOT NULL
  AND length(regexp_replace(c.telefone, '[^0-9]', '', 'g')) > 0
  AND regexp_replace(c.telefone, '[^0-9]', '', 'g') = (
    CASE
      WHEN length(regexp_replace(p.telefone, '[^0-9]', '', 'g')) > 11
       AND regexp_replace(p.telefone, '[^0-9]', '', 'g') LIKE '55%'
      THEN substring(regexp_replace(p.telefone, '[^0-9]', '', 'g') FROM 3)
      ELSE regexp_replace(p.telefone, '[^0-9]', '', 'g')
    END
  );
