-- Programa de Parceiras passa a dar Plano Studio grátis (era Pro). O
-- benefício é definido pelo cargo, não pela data em que a parceira entrou no
-- programa — migra quem já é parceira hoje pra manter isso consistente.
update prestadoras set plano = 'studio' where e_parceira = true;
