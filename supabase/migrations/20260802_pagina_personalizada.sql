-- Personalização da página pública (/n/[slug]): texto/badges configuráveis,
-- avaliações em destaque (toggle apenas — a seleção em si já existia via
-- avaliacoes.destaque), galeria de trabalhos com seleção/modo de exibição, e
-- nova seção de fotos do estabelecimento.

ALTER TABLE prestadoras
  ADD COLUMN IF NOT EXISTS pagina_texto_agendamento text
    DEFAULT 'Agendamento online 24h',
  ADD COLUMN IF NOT EXISTS pagina_mostrar_texto_agendamento
    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pagina_mostrar_estrelas
    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pagina_mostrar_avaliacoes
    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pagina_mostrar_galeria
    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS pagina_galeria_modo
    text DEFAULT 'empilhada'
    CHECK (pagina_galeria_modo IN ('empilhada', 'carrossel')),
  ADD COLUMN IF NOT EXISTS pagina_galeria_fotos_ids
    uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pagina_mostrar_estabelecimento
    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagina_estabelecimento_modo
    text DEFAULT 'empilhada'
    CHECK (pagina_estabelecimento_modo IN ('empilhada', 'carrossel')),
  ADD COLUMN IF NOT EXISTS pagina_estabelecimento_fotos_ids
    uuid[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pagina_estabelecimento_titulo
    text DEFAULT 'Nosso espaço';
