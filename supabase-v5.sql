-- Execute no Supabase SQL Editor antes do deploy V5

-- Adicionar colunas de contrato na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notas_fiscais TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS valor_mensal DECIMAL(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tempo_contrato TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS inicio_contrato DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS fim_contrato DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS situacao_contrato TEXT;

-- Atualizar constraint de tipos de evento na agenda
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_type_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_type_check 
CHECK (type IN ('meeting','capture','capture_external','capture_studio','recording','delivery','internal','commercial'));

SELECT 'V5 SQL executado com sucesso' as status;
