-- Seed das 20 missões fixas + 1 missão bônus. Idempotente via ON CONFLICT
-- (tipo) DO NOTHING — pode rodar de novo sem duplicar linhas.

-- AGENDAMENTOS
INSERT INTO missoes (titulo, descricao, icone, tipo, meta_base, disponivel_basico, disponivel_pro) VALUES
('Conclua atendimentos', 'Conclua X atendimentos com clientes diferentes este mês', 'Calendar', 'agendamentos', 10, true, true),
('Atenda clientes diferentes', 'Atenda X clientes diferentes este mês', 'Users', 'clientes_diferentes', 8, true, true),
-- AVALIAÇÕES
('Receba avaliações', 'Receba avaliações de X clientes diferentes este mês', 'Star', 'avaliacoes', 5, true, true),
('Mantenha nota alta', 'Mantenha sua média acima de 4.5 estrelas este mês', 'StarHalf', 'nota_media', 1, true, true),
-- CANCELAMENTOS
('Reduza cancelamentos', 'Tenha menos de X cancelamentos este mês', 'XCircle', 'cancelamentos', 3, true, true),
('Zero cancelamentos', 'Fique 2 semanas sem nenhum cancelamento', 'ShieldCheck', 'zero_cancelamentos', 1, true, true),
-- CLIENTES
('Atraia clientes novos', 'Atenda X clientes novos este mês', 'UserPlus', 'clientes_novos', 5, true, true),
('Reconquiste clientes', 'Traga de volta X clientes que não vêm há mais de 30 dias', 'RefreshCw', 'clientes_recorrentes', 3, true, true),
-- WHATSAPP
('Envie lembretes', 'Envie lembrete para X clientes diferentes este mês', 'MessageCircle', 'lembretes', 8, true, true),
('Confirme agendamentos', 'Envie confirmação para todos os agendamentos da semana', 'CheckCircle', 'confirmacoes', 1, true, true),
-- SERVIÇOS
('Atualize seus serviços', 'Cadastre ou edite um serviço este mês', 'Scissors', 'servicos', 1, true, true),
('Personalize ícones', 'Adicione ícone personalizado em todos os serviços', 'Sparkles', 'icones_servicos', 1, true, true),
-- GALERIA (só Pro)
('Atualize a galeria', 'Adicione X fotos na galeria este mês', 'Image', 'galeria', 3, false, true),
('Galeria completa', 'Mantenha a galeria com pelo menos 5 fotos', 'Images', 'galeria_minima', 5, false, true),
-- FATURAMENTO
('Bata sua meta de faturamento', 'Fature R$X este mês', 'DollarSign', 'faturamento', 500, true, true),
('Sprint de faturamento', 'Fature R$X em uma única semana', 'Zap', 'faturamento_semanal', 200, true, true),
-- PERFIL
('Complete seu perfil', 'Complete 100% do seu perfil (bio, foto, redes sociais)', 'User', 'perfil_completo', 1, true, true),
('Personalize sua página', 'Personalize a cor da sua página pública', 'Palette', 'cor_tema', 1, false, true),
-- RECORRÊNCIA
('Fidelidade de clientes', 'Tenha X clientes que agendaram mais de uma vez este mês', 'Heart', 'clientes_fidelizados', 4, true, true),
('Taxa de retorno', 'Mantenha X% de taxa de retorno de clientes', 'TrendingUp', 'taxa_retorno', 30, true, true)
ON CONFLICT (tipo) DO NOTHING;

-- MISSÃO BÔNUS
INSERT INTO missoes (titulo, descricao, icone, tipo, meta_base, disponivel_basico, disponivel_pro, desconto_percentual) VALUES
('Indique uma amiga', 'Indique uma profissional que assine um plano e ganhe 1 mês grátis', 'Gift', 'indicacao_bonus', 1, true, true, 100)
ON CONFLICT (tipo) DO NOTHING;
