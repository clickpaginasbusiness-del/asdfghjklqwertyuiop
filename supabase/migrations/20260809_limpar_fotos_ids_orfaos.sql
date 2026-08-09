-- Limpeza única de dados: pagina_galeria_fotos_ids e pagina_estabelecimento_fotos_ids
-- podiam acumular ids de fotos já excluídas da galeria (o handleDelete de
-- GaleriaClient.tsx nunca limpava esses arrays), inflando o contador "X/10" no
-- modal "Personalizar Página" mesmo sem nenhuma foto real selecionável.
-- Idempotente: só remove ids que não existem mais em galeria, pode rodar de novo sem efeito.

UPDATE prestadoras
SET pagina_galeria_fotos_ids = COALESCE(
  (SELECT array_agg(fid) FROM unnest(pagina_galeria_fotos_ids) AS fid WHERE fid IN (SELECT id FROM galeria)),
  '{}'
)
WHERE array_length(pagina_galeria_fotos_ids, 1) > 0;

UPDATE prestadoras
SET pagina_estabelecimento_fotos_ids = COALESCE(
  (SELECT array_agg(fid) FROM unnest(pagina_estabelecimento_fotos_ids) AS fid WHERE fid IN (SELECT id FROM galeria)),
  '{}'
)
WHERE array_length(pagina_estabelecimento_fotos_ids, 1) > 0;
