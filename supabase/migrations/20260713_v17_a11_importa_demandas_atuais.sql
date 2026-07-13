-- V17-A11 — Importação das demandas atuais da Ampy
-- Projeto: ampy-operacional
-- Marcador idempotente: AMPY-IMPORT-JIRA-AGENDA-2026-07
-- Esta migration pode ser executada novamente sem duplicar demandas/agendas.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ampy_norm(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(
      lower(coalesce(value, '')),
      'áàâãäéèêëíìîïóòôõöúùûüç',
      'aaaaaeeeeiiiiooooouuuuc'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  );
$$;

CREATE TEMP TABLE ampy_import_context AS
SELECT tm.profile_id AS manager_id
FROM public.team_members tm
WHERE lower(tm.email) = 'ampydigital@gmail.com'
  AND tm.profile_id IS NOT NULL
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ampy_import_context) THEN
    RAISE EXCEPTION 'Perfil gestor ampydigital@gmail.com não encontrado.';
  END IF;
END
$$;

CREATE TEMP TABLE ampy_client_aliases (
  import_name text NOT NULL,
  alias_name text NOT NULL
);

INSERT INTO ampy_client_aliases (import_name, alias_name) VALUES
  ('Adv. Maiara', 'Maiara Luz'),
  ('Adv. Maiara', 'Maiara'),
  ('Dra. Mariele', 'Dra. Mariele Tavares'),
  ('Dra. Mariele', 'Mariele Tavares'),
  ('Dra. Mariele', 'Mariele'),
  ('Clínica Dra. Lanuxa', 'Clínica Lanuxa Odontológica'),
  ('Clínica Dra. Lanuxa', 'Lanuxa'),
  ('Hospital Veterinário IMAS', 'Hospital Veterinário IMAS'),
  ('Hospital Veterinário IMAS', 'IMAS'),
  ('Florestal', 'Florestal Blocos e Pavers'),
  ('Luminous', 'Luminous Store'),
  ('Sognare', 'Sognare Marcas'),
  ('Vic Disney', 'Vic Salvalaggio Disney'),
  ('Bentô Cookies', 'Bento Cookies'),
  ('Bentô Cookies', 'Bento Cookie'),
  ('JG Uniformes', 'Uniformes JG'),
  ('Clínica Vissá', 'Vissá Clínica'),
  ('Bufallo Couro', 'Bufallo Couro'),
  ('Rede Furnas', 'Rede Furnas'),
  ('Stylos Hair', 'Stylos Hair'),
  ('Maline Modas', 'Maline Modas'),
  ('Luana Arquiteta', 'Luana Arquiteta'),
  ('Isa Psicóloga', 'Isa Psicóloga');

CREATE TEMP TABLE ampy_import_demands (
  import_flag text NOT NULL,
  code text NOT NULL,
  record_type text,
  client_name text,
  title text NOT NULL,
  description text,
  work_type text,
  responsible_email text,
  work_status text,
  priority text,
  start_date date,
  final_deadline date,
  original_period text,
  parent_group text,
  source_name text,
  jira_id text,
  tags_hours text,
  confidence text,
  review_note text,
  drive_link text,
  extra_notes text
);

INSERT INTO ampy_import_demands (
  import_flag, code, record_type, client_name, title, description,
  work_type, responsible_email, work_status, priority,
  start_date, final_deadline, original_period, parent_group,
  source_name, jira_id, tags_hours, confidence, review_note,
  drive_link, extra_notes
) VALUES
  ('Sim', 'DEM-001', 'Ciclo recorrente', 'Euphoria', 'PLAN EUPHORIA - 19/06 A 10/07', 'Ciclo operacional do cliente.', 'Planejamento', 'ampyplanejamento@gmail.com', 'not_started', 'high', '2026-06-19', '2026-07-10', '19/06 a 10/07', 'Euphoria — ciclo 19/06 a 10/07', 'Jira — Equipe Execução / Planejamento', 'EQE-33', NULL, 'Confirmado', 'Validar status atual; prazo já vencido no print.', NULL, NULL),
  ('Sim', 'DEM-002', 'Ciclo recorrente', 'Elite', 'PLAN ELITE - 07/07 A 11/07', 'Ciclo operacional com reunião e captação indicadas no card.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'high', '2026-07-07', '2026-07-11', '07/07 a 11/07', 'Elite — ciclo 07/07 a 11/07', 'Jira — Equipe Execução / Captação', 'EQE-67', 'REU-29/06-18H; CAP-07/07-09:30H', 'Confirmado', 'Validar se o ciclo já foi concluído.', NULL, NULL),
  ('Sim', 'DEM-003', 'Ciclo recorrente', 'Melp', 'PLAN MELP - 19/07 A 19/08', 'Ciclo operacional; captação ainda precisava de confirmação.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'normal', '2026-07-19', '2026-08-19', '19/07 a 19/08', 'Melp — ciclo 19/07 a 19/08', 'Jira — Equipe Execução / Captação', 'EQE-100', 'CONFIRMAR-CAPTAÇÃO', 'Confirmado', 'Confirmar data final da captação.', NULL, NULL),
  ('Sim', 'DEM-004', 'Ciclo recorrente', 'Top Lar', 'PLAN TOP LAR - 15/07 A 15/08', 'Ciclo operacional com captação informada.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'normal', '2026-07-15', '2026-08-15', '15/07 a 15/08', 'Top Lar — ciclo 15/07 a 15/08', 'Jira — Equipe Execução / Captação', 'EQE-89', 'CAP-10/07-13:40H', 'Confirmado', 'Revisar se a captação de 10/07 ocorreu.', NULL, NULL),
  ('Sim com validação', 'DEM-005', 'Ciclo recorrente', 'AFAPV', 'AFAPV - 15/06 - 15/07', 'Ciclo operacional. O período termina em 15/07, mas o prazo exibido no card é 15/08.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'normal', '2026-06-15', '2026-08-15', '15/06 a 15/07', 'AFAPV — ciclo 15/06 a 15/07', 'Jira — Equipe Execução / Captação', 'EQE-83', 'CAP-09/07-16H', 'Precisa validar', 'Corrigir prazo: 15/07 ou 15/08.', NULL, NULL),
  ('Sim', 'DEM-006', 'Ciclo recorrente', 'Andreza', 'PLAN ANDREZA - 25/07 A 25/08', 'Ciclo operacional com captação registrada.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'normal', '2026-07-25', '2026-08-25', '25/07 a 25/08', 'Andreza — ciclo 25/07 a 25/08', 'Jira — Equipe Execução / Captação', 'EQE-16', 'CAP-09/07-13:30H', 'Confirmado', 'Conferir se CAP DEZA da Agenda corresponde a Andreza.', NULL, NULL),
  ('Sim', 'DEM-007', 'Ciclo recorrente', 'Bufallo Couro', 'PLAN BUFALLO COURO - 20/07 A 20/08', 'Ciclo operacional com captação registrada.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'normal', '2026-07-20', '2026-08-20', '20/07 a 20/08', 'Bufallo Couro — ciclo 20/07 a 20/08', 'Jira — Equipe Execução / Captação', 'EQE-42', 'CAP-14/07-15:30H', 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-008', 'Ciclo recorrente', 'Emagrecentro', 'PLAN EMAGRECENTRO - 27/07 A 31/08', 'Ciclo operacional com captação registrada.', 'Captação', 'ampycaptacao@gmail.com', 'waiting', 'normal', '2026-07-27', '2026-08-31', '27/07 a 31/08', 'Emagrecentro — ciclo 27/07 a 31/08', 'Jira — Equipe Execução / Captação', 'EQE-102', 'CAP-10/07-09H', 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-009', 'Demanda específica', 'Emagrecentro', 'PLAN EMAGRECENTRO - CURSO 2 MARÇO', 'Demanda antiga/específica ligada ao curso 2 de março.', 'Edição', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', NULL, '2026-07-18', NULL, 'Emagrecentro — curso 2 março', 'Jira — Equipe Execução / Edição-Design', 'EQE-68', NULL, 'Confirmado', 'Definir se é edição ou design e qual material deve ser entregue.', NULL, NULL),
  ('Sim', 'DEM-010', 'Ciclo recorrente', 'Slim', 'PLAN SLIM - 18/07 A 09/09', 'Ciclo operacional em Edição/Design.', 'Edição', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-18', '2026-09-09', '18/07 a 09/09', 'Slim — ciclo 18/07 a 09/09', 'Jira — Equipe Execução / Edição-Design', 'EQE-34', NULL, 'Confirmado', 'Responsável final deve ser definido entre Edição e Design.', NULL, NULL),
  ('Sim', 'DEM-011', 'Ciclo recorrente', 'Inovare', 'PLAN INOVARE - 19/07 A 09/08', 'Ciclo operacional. Há um post do mês anterior não publicado, descrito como trend.', 'Edição', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-19', '2026-08-09', '19/07 a 09/08', 'Inovare — ciclo 19/07 a 09/08', 'Jira — Equipe Execução / Edição-Design', 'EQE-43', 'CAP-08/06-14H', 'Confirmado', 'Tratar o post não publicado como pendência separada se ainda estiver ativo.', NULL, NULL),
  ('Sim', 'DEM-012', 'Ciclo recorrente', 'Florestal', 'PLAN FLORESTAL - 23/07 A 23/08', 'Ciclo operacional em Edição/Design.', 'Edição', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-23', '2026-08-23', '23/07 a 23/08', 'Florestal — ciclo 23/07 a 23/08', 'Jira — Equipe Execução / Edição-Design', 'EQE-58', NULL, 'Confirmado', 'Definir setor responsável atual.', NULL, NULL),
  ('Sim', 'DEM-013', 'Ciclo recorrente', 'Sognare', 'PLAN SOGNARE - 16/07 A 16/08', 'Ciclo operacional com captação registrada.', 'Edição', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-16', '2026-08-16', '16/07 a 16/08', 'Sognare — ciclo 16/07 a 16/08', 'Jira — Equipe Execução / Edição-Design', 'EQE-94', 'CAP-09/07-13:30H', 'Confirmado', 'Definir setor atual entre Edição e Design.', NULL, NULL),
  ('Sim', 'DEM-014', 'Ciclo recorrente', 'Hospital Veterinário IMAS', 'PLAN HOSPITAL VETERINÁRIO IMAS - 15/07 A 16/08', 'Ciclo operacional em organização/ordenação de postagens.', 'Organização de Feed', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-15', '2026-08-16', '15/07 a 16/08', 'IMAS — ciclo 15/07 a 16/08', 'Jira — Equipe Execução / Organização Feed', 'EQE-71', NULL, 'Confirmado', 'Usar nomenclatura futura de organização/ordenação das postagens.', NULL, NULL),
  ('Sim', 'DEM-015', 'Ciclo recorrente', 'Zero Nov9', 'PLAN ZERO NOV9 - 11/07 A 02/08', 'Ciclo operacional em Programação/Postagem.', 'Programação', 'ampyprogramacao@gmail.com', 'waiting', 'normal', '2026-07-11', '2026-08-02', '11/07 a 02/08', 'Zero Nov9 — ciclo 11/07 a 02/08', 'Jira — Equipe Execução / Programação Postagem', 'EQE-75', 'PROG-PEND-14/07', 'Confirmado', NULL, NULL, NULL),
  ('Sim com validação', 'DEM-016', 'Ciclo recorrente', 'Clínica Dra. Lanuxa', 'PLAN CLÍNICA DRA. LANUXA - 06/07 A 09/08', 'Ciclo operacional em andamento. O prazo exibido é 06/08, diferente do fim do período.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-06', '2026-08-06', '06/07 a 09/08', 'Clínica Dra. Lanuxa — ciclo 06/07 a 09/08', 'Jira — Equipe Execução / Em andamento', 'EQE-61', 'PROG-PEND-13/07', 'Precisa validar', 'Confirmar se o prazo correto é 06/08 ou 09/08.', NULL, NULL),
  ('Sim', 'DEM-017', 'Ciclo recorrente', 'Clínica Vissá', 'PLAN CLÍNICA VISSÁ - 06/07 A 06/08', 'Ciclo operacional em andamento.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-06', '2026-08-06', '06/07 a 06/08', 'Clínica Vissá — ciclo 06/07 a 06/08', 'Jira — Equipe Execução / Em andamento', 'EQE-36', 'PROG-PEND-13/07', 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-018', 'Ciclo recorrente', 'Vista Esquadrias', 'PLAN VISTA ESQUADRIAS - 13/06 A 13/07', 'Ciclo operacional em andamento.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'high', '2026-06-13', '2026-07-13', '13/06 a 13/07', 'Vista Esquadrias — ciclo 13/06 a 13/07', 'Jira — Equipe Execução / Em andamento', 'EQE-26', 'CAP-11/06-09H', 'Confirmado', 'Prazo muito próximo no momento do print.', NULL, NULL),  ('Sim', 'DEM-019', 'Ciclo recorrente', 'Dra. Mariele', 'DRA. MARIELE - 02/07 A 16/07', 'Ciclo operacional em andamento.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-02', '2026-07-16', '02/07 a 16/07', 'Dra. Mariele — ciclo 02/07 a 16/07', 'Jira — Equipe Execução / Em andamento', 'EQE-86', NULL, 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-020', 'Ciclo recorrente', 'Adv. Maiara', 'PLAN ADV MAIARA - 15/06 A 31/07', 'Ciclo operacional com programação pendente, captação e reunião a confirmar.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'high', '2026-06-15', '2026-07-31', '15/06 a 31/07', 'Adv. Maiara — ciclo 15/06 a 31/07', 'Jira — Equipe Execução / Em andamento', 'EQE-88', 'PROG-PEND-17/07; CONFIRMAR-CAPTAÇÃO; CONFIRMAR-REUNIÃO', 'Confirmado', 'Há três pendências operacionais no mesmo card.', NULL, NULL),
  ('Sim', 'DEM-021', 'Ciclo recorrente', 'Maline Modas', 'MALINE MODAS - 29/06 A 22/07', 'Ciclo operacional em andamento.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-06-29', '2026-07-22', '29/06 a 22/07', 'Maline Modas — ciclo 29/06 a 22/07', 'Jira — Equipe Execução / Em andamento', 'EQE-92', NULL, 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-022', 'Ciclo recorrente', 'Bentô Cookies', 'PLAN BENTÔ COOKIES - 04/07 A 03/08', 'Ciclo operacional em andamento.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-04', '2026-08-03', '04/07 a 03/08', 'Bentô Cookies — ciclo 04/07 a 03/08', 'Jira — Equipe Execução / Em andamento', NULL, 'PROG-PEND-23/07', 'Parcial', 'ID do Jira não ficou legível.', NULL, NULL),
  ('Sim com validação', 'DEM-023', 'Ciclo recorrente', 'Vic Disney', 'PLAN VIC DISNEY - 08/06 A 25/07', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-06-08', '2026-07-25', '08/06 a 25/07 (leitura parcial)', 'Vic Disney — ciclo parcial', 'Jira — Equipe Execução / Em andamento', 'EQE-79?', NULL, 'Parcial', 'Validar período e ID.', NULL, NULL),
  ('Sim com validação', 'DEM-024', 'Ciclo recorrente', 'JG Uniformes', 'PLAN JG UNIFORMES - 04/07 A 04/08', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-04', '2026-08-04', '04/07 a 04/08', 'JG Uniformes — ciclo 04/07 a 04/08', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Provável', 'Validar ID do Jira.', NULL, NULL),
  ('Sim com validação', 'DEM-025', 'Ciclo recorrente', 'Luana Arquiteta', 'PLAN LUANA ARQUITETA - 25/07 A 25/08', 'O card comprimido mostra uma data de 27/07 que pode ser prazo intermediário.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-25', '2026-07-27', '25/07 a 25/08', 'Luana Arquiteta — ciclo 25/07 a 25/08', 'Jira — Equipe Execução / Em andamento', 'EQE-34?', 'Tag de captação parcialmente legível', 'Parcial', 'Confirmar prazo real e ID.', NULL, NULL),
  ('Sim com validação', 'DEM-026', 'Ciclo recorrente', 'Casagrande Advogados', 'PLAN CASAGRANDE ADV - 06/07 A 05/08', 'Ciclo operacional em andamento; tag de programação parcialmente legível.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-06', '2026-08-05', '06/07 a 05/08', 'Casagrande Advogados — ciclo 06/07 a 05/08', 'Jira — Equipe Execução / Em andamento', 'EQE-72?', 'PROG-PEND (parcial)', 'Parcial', 'Validar ID e data da pendência de programação.', NULL, NULL),
  ('Sim com validação', 'DEM-027', 'Ciclo recorrente', 'A validar — cliente semelhante a Hotel', 'PLAN CLIENTE ILEGÍVEL (HOTEL) - PERÍODO PARCIAL', 'Card de baixa resolução; nome do cliente e período não puderam ser confirmados.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', NULL, '2026-07-29', 'Período ilegível', 'Cliente hotel — ciclo parcial', 'Jira — Equipe Execução / Em andamento', 'EQE-41?', 'Tag de programação parcialmente legível', 'Ilegível', 'Identificar cliente, período, ID e tag.', NULL, NULL),
  ('Sim com validação', 'DEM-028', 'Ciclo recorrente', 'Stylos Hair', 'PLAN STYLOS HAIR - 02/07 A 11/08', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-02', '2026-08-11', '02/07 a 11/08', 'Stylos Hair — ciclo 02/07 a 11/08', 'Jira — Equipe Execução / Em andamento', 'EQE-39?', 'PROG-PEND (parcial)', 'Parcial', 'Validar datas e ID.', NULL, NULL),
  ('Sim com validação', 'DEM-029', 'Ciclo recorrente', 'La Bella', 'PLAN LA BELLA - 30/06 A 12/07', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'high', '2026-06-30', '2026-07-12', '30/06 a 12/07', 'La Bella — ciclo 30/06 a 12/07', 'Jira — Equipe Execução / Em andamento', 'EQE-43?', NULL, 'Parcial', 'Validar período e ID.', NULL, NULL),
  ('Sim com validação', 'DEM-030', 'Ciclo recorrente', 'Rede Furnas', 'PLAN REDE FURNAS - 28/06 A 31/07', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-06-28', '2026-07-31', '28/06 a 31/07', 'Rede Furnas — ciclo 28/06 a 31/07', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Parcial', 'Validar datas e ID.', NULL, NULL),
  ('Sim com validação', 'DEM-031', 'Ciclo recorrente', 'Isa Psicóloga', 'PLAN ISA PSICÓLOGA - 09/07 A 31/07', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-09', '2026-07-31', '09/07 a 31/07', 'Isa Psicóloga — ciclo 09/07 a 31/07', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Parcial', 'Validar ID e confirmar datas.', NULL, NULL),
  ('Sim com validação', 'DEM-032', 'Ciclo recorrente', 'Luminous', 'PLAN LUMINOUS - 07/07 A 30/08', 'Leitura parcial do card comprimido; há programação pendente.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-07', '2026-08-30', '07/07 a 30/08', 'Luminous — ciclo 07/07 a 30/08', 'Jira — Equipe Execução / Em andamento', 'EQE-71?', 'PROG-PEND (parcial)', 'Parcial', 'Validar período, ID e data da programação.', NULL, NULL),
  ('Sim com validação', 'DEM-033', 'Ciclo recorrente', 'Essence Blue', 'PLAN ESSENCE BLUE - 13/07 A 11/08', 'Leitura parcial do card comprimido; há programação pendente.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-13', '2026-08-11', '13/07 a 11/08', 'Essence Blue — ciclo 13/07 a 11/08', 'Jira — Equipe Execução / Em andamento', NULL, 'PROG-PEND (parcial)', 'Parcial', 'Validar período, ID e data da programação.', NULL, NULL),
  ('Sim com validação', 'DEM-034', 'Ciclo recorrente', 'Euphoria', 'PLAN EUPHORIA - 09/07 A 09/08', 'Segundo ciclo/aparição de Euphoria, diferente do ciclo encerrado em 10/07.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-09', '2026-08-09', '09/07 a 09/08', 'Euphoria — ciclo 09/07 a 09/08', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Parcial', 'Confirmar se é realmente um novo ciclo e validar ID.', NULL, NULL),
  ('Sim com validação', 'DEM-035', 'Ciclo recorrente', 'Maline Masculina', 'PLAN MALINE MASCULINA - 08/07 A 04/08', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-08', '2026-08-04', '08/07 a 04/08', 'Maline Masculina — ciclo 08/07 a 04/08', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Parcial', 'Validar datas e ID.', NULL, NULL),
  ('Sim com validação', 'DEM-036', 'Ciclo recorrente', 'Paraíso', 'PLAN PARAÍSO - 03/06 A 03/08', 'Leitura parcial do card comprimido; há cards setoriais relacionados.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-06-03', '2026-08-03', '03/06 a 03/08', 'Paraíso — ciclo 03/06 a 03/08', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Parcial', 'O quadro de Edição/Design mostra período 06/06 a 05/07; reconciliar.', NULL, NULL),
  ('Sim com validação', 'DEM-037', 'Ciclo recorrente', 'Dudalina', 'PLAN DUDALINA - 01/07 A 03/08', 'Leitura parcial do card comprimido.', 'Planejamento', 'ampyprogramacao@gmail.com', 'in_progress', 'normal', '2026-07-01', '2026-08-03', '01/07 a 03/08', 'Dudalina — ciclo parcial', 'Jira — Equipe Execução / Em andamento', NULL, NULL, 'Parcial', 'Validar período e ID.', NULL, NULL),
  ('Sim', 'DEM-038', 'Organização interna', 'Ampy Digital', 'Fazer Drive com fotos e vídeos da Ampy', 'Organizar e disponibilizar fotos e vídeos da Ampy no Drive.', 'Captação', 'ampycaptacao@gmail.com', 'not_started', 'normal', NULL, NULL, NULL, 'Interno Ampy — organização de acervo', 'Jira — Captação / Extras-Ajustes', 'CPE-57', NULL, 'Confirmado', 'Definir pasta do Drive e critério de conclusão.', NULL, NULL),
  ('Sim', 'DEM-039', 'Demanda específica', 'Luana Arquiteta', 'Gravar vídeo de Tour para Luana Arquiteta', 'Captação de vídeo de tour.', 'Captação', 'ampycaptacao@gmail.com', 'not_started', 'normal', NULL, NULL, NULL, 'Luana Arquiteta — ciclo 25/07 a 25/08', 'Jira — Captação / Extras-Ajustes', 'CPE-58', NULL, 'Confirmado', 'Vincular à captação de 21/07 se for o mesmo trabalho.', NULL, NULL),
  ('Sim', 'DEM-040', 'Demanda interna', 'Ampy Digital', 'CAP-AMPY', 'Captação interna da Ampy.', 'Captação', 'ampycaptacao@gmail.com', 'not_started', 'high', NULL, '2026-06-26', NULL, 'Interno Ampy — captação', 'Jira — Captação / Extras-Ajustes', 'CPE-61', 'PRAZO-26-06', 'Confirmado', 'Prazo vencido no momento do print; validar se já foi executada.', NULL, NULL),
  ('Sim', 'DEM-041', 'Organização interna', 'Ampy Digital', 'ORGANIZAR HUB CLIENTES - FOTOS', 'Organizar as fotos dos clientes no Hub/Drive.', 'Captação', 'ampycaptacao@gmail.com', 'not_started', 'normal', NULL, NULL, NULL, 'Interno Ampy — organização Hub', 'Jira — Captação / Demanda Padrão', 'CPE-53', NULL, 'Confirmado', 'Definir escopo de clientes e pasta de destino.', NULL, NULL),
  ('Sim', 'DEM-042', 'Atividade vinculada', 'Paraíso', 'Edição — PLAN PARAÍSO - 06/06 A 05/07', 'Atividade de Edição vinculada ao ciclo de Paraíso.', 'Edição', 'ampyedicao@gmail.com', 'not_started', 'normal', '2026-06-06', '2026-08-03', '06/06 a 05/07', 'Paraíso — ciclo 03/06 a 03/08', 'Jira — Edição / Demanda Padrão', 'EDE-256', NULL, 'Confirmado', 'Prazo herdado do ciclo macro; revisar período divergente.', NULL, NULL),  ('Sim', 'DEM-043', 'Atividade vinculada', 'Slim', 'Edição — PLAN SLIM - 18/07 A 09/09', 'Atividade de Edição vinculada ao ciclo Slim.', 'Edição', 'ampyedicao@gmail.com', 'not_started', 'normal', '2026-07-18', '2026-09-09', '18/07 a 09/09', 'Slim — ciclo 18/07 a 09/09', 'Jira — Edição / Demanda Padrão', 'EDE-257', NULL, 'Confirmado', 'Prazo herdado do ciclo.', NULL, NULL),
  ('Sim', 'DEM-044', 'Atividade vinculada', 'Hospital Veterinário IMAS', 'Edição — PLAN HOSPITAL VETERINÁRIO IMAS - 16/07 A 16/08', 'Atividade de Edição vinculada ao ciclo IMAS.', 'Edição', 'ampyedicao@gmail.com', 'not_started', 'normal', '2026-07-16', '2026-08-16', '16/07 a 16/08', 'IMAS — ciclo 15/07 a 16/08', 'Jira — Edição / Do dia', 'EDE-249', NULL, 'Confirmado', 'Data inicial difere em um dia do ciclo macro.', NULL, NULL),
  ('Sim', 'DEM-045', 'Atividade vinculada', 'Zero Nov9', 'Edição — PLAN ZERO NOV9 - 11/07 A 02/08', 'Atividade de Edição vinculada ao ciclo Zero Nov9.', 'Edição', 'ampyedicao@gmail.com', 'not_started', 'normal', '2026-07-11', '2026-08-02', '11/07 a 02/08', 'Zero Nov9 — ciclo 11/07 a 02/08', 'Jira — Edição / Do dia', 'EDE-252', NULL, 'Confirmado', 'Prazo herdado do ciclo.', NULL, NULL),
  ('Sim', 'DEM-046', 'Demanda específica', 'Bentô Cookies', 'VÍDEO TRÁFEGO - BENTÔ', 'Editar vídeo para campanha de tráfego da Bentô.', 'Edição', 'ampyedicao@gmail.com', 'not_started', 'high', NULL, '2026-07-09', NULL, 'Bentô Cookies — ciclo 04/07 a 03/08', 'Jira — Edição / Do dia', 'EDE-259', 'PRAZO-09/07', 'Confirmado', 'Prazo vencido no momento do print; revisar conclusão.', NULL, NULL),
  ('Sim', 'DEM-047', 'Atividade vinculada', 'JG Uniformes', 'Edição — PLAN JG UNIFORMES - 04/07 A 04/08', 'Atividade de Edição vinculada ao ciclo JG Uniformes.', 'Edição', 'ampyedicao@gmail.com', 'in_progress', 'normal', '2026-07-04', '2026-08-04', '04/07 a 04/08', 'JG Uniformes — ciclo 04/07 a 04/08', 'Jira — Edição / Em andamento', 'EDE-255', NULL, 'Confirmado', 'Prazo herdado do ciclo.', NULL, NULL),
  ('Sim', 'DEM-048', 'Demanda específica', 'Stylos Hair', 'LOGO STYLOS HAIR', 'Criação ou ajuste de logo para Stylos Hair.', 'Design', 'ampydesign@gmail.com', 'not_started', 'high', NULL, '2026-07-06', NULL, 'Stylos Hair — ciclo 02/07 a 11/08', 'Jira — Design / Extras-Ajustes', 'DGE-330', 'PRAZO-06/07', 'Confirmado', 'Prazo vencido; validar se já foi concluída.', NULL, NULL),
  ('Sim', 'DEM-049', 'Demanda específica', 'Rede Furnas', 'CARDÁPIO PÃES REDE FURNAS', 'Criar ou ajustar cardápio de pães da Rede Furnas.', 'Design', 'ampydesign@gmail.com', 'not_started', 'high', NULL, '2026-07-10', NULL, 'Rede Furnas — ciclo 28/06 a 31/07', 'Jira — Design / Extras-Ajustes', 'DGE-345', 'PRAZO-10/07', 'Confirmado', 'Prazo vencido; validar conclusão.', NULL, NULL),
  ('Sim', 'DEM-050', 'Atividade vinculada', 'Zero Nov9', 'Design — PLAN ZERO NOV9 - 11/07 A 02/08', 'Atividade de Design vinculada ao ciclo Zero Nov9.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', '2026-07-11', '2026-08-02', '11/07 a 02/08', 'Zero Nov9 — ciclo 11/07 a 02/08', 'Jira — Design / Extras-Ajustes', 'DGE-343', NULL, 'Confirmado', 'Prazo herdado do ciclo.', NULL, NULL),
  ('Sim', 'DEM-051', 'Atividade vinculada', 'Paraíso', 'Design — PLAN PARAÍSO - 06/06 A 05/07', 'Atividade de Design vinculada ao ciclo Paraíso.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', '2026-06-06', '2026-08-03', '06/06 a 05/07', 'Paraíso — ciclo 03/06 a 03/08', 'Jira — Design / Extras-Ajustes', 'DGE-342', NULL, 'Confirmado', 'Prazo herdado do ciclo macro; reconciliar período.', NULL, NULL),
  ('Sim', 'DEM-052', 'Ajuste', 'Adv. Maiara', 'ALTERAÇÕES MAIARA', 'Alterações solicitadas para materiais da Adv. Maiara.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', NULL, '2026-07-17', NULL, 'Adv. Maiara — ciclo 15/06 a 31/07', 'Jira — Design / Extras-Ajustes', 'DGE-324', 'PRAZO-17/07', 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-053', 'Demanda específica', 'Emagrecentro', 'CATÁLOGO EMAGRECENTRO', 'Desenvolver catálogo para Emagrecentro.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', NULL, '2026-07-18', NULL, 'Emagrecentro — ciclo 27/07 a 31/08', 'Jira — Design / Extras-Ajustes', 'DGE-333', 'PRAZO-18/07', 'Confirmado', NULL, NULL, NULL),
  ('Sim com validação', 'DEM-054', 'Ajuste', 'A validar', 'ALTERAÇÃO EVENTO', 'Alteração de material de evento; cliente não indicado no card.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', NULL, '2026-07-23', NULL, 'Evento — cliente a validar', 'Jira — Design / Extras-Ajustes', 'DGE-348', 'PRAZO-23/07', 'Precisa validar', 'Identificar cliente e arquivo relacionado.', NULL, NULL),
  ('Sim', 'DEM-055', 'Ajuste', 'Stylos Hair', 'ALTERAÇÃO STYLOS', 'Alterações de materiais da Stylos Hair.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', NULL, '2026-07-29', NULL, 'Stylos Hair — ciclo 02/07 a 11/08', 'Jira — Design / Extras-Ajustes', 'DGE-353', 'PRAZO-29/07', 'Confirmado', NULL, NULL, NULL),
  ('Sim', 'DEM-056', 'Demanda recorrente interna', 'Clientes padrão', 'STORY - CLIENTES PADRÃO', 'Produção recorrente de stories para clientes padrão.', 'Design', 'ampydesign@gmail.com', 'not_started', 'normal', NULL, NULL, NULL, 'Operação recorrente — stories', 'Jira — Design / Demanda Padrão', 'DGE-241', NULL, 'Confirmado', 'Definir frequência, quantidade e clientes abrangidos.', NULL, NULL),
  ('Sim', 'DEM-057', 'Demanda específica', 'Dra. Mariele', 'LOGO DRA. MARIELE', 'Criação ou ajuste de logo da Dra. Mariele.', 'Design', 'ampydesign@gmail.com', 'in_progress', 'high', NULL, '2026-06-26', NULL, 'Dra. Mariele — ciclo 02/07 a 16/07', 'Jira — Design / Em andamento (Gustavo)', 'DGE-331', 'PRAZO-26/06', 'Confirmado', 'Prazo vencido; validar se permanece ativa e quem é o responsável atual.', NULL, NULL);

CREATE TEMP TABLE ampy_import_agenda (
  import_flag text NOT NULL,
  code text NOT NULL,
  event_type text,
  client_name text,
  title text NOT NULL,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  responsible_email text,
  linked_group text,
  source_name text,
  observation text,
  confidence text,
  conflict_note text,
  demand_code text
);

INSERT INTO ampy_import_agenda (
  import_flag, code, event_type, client_name, title, event_date,
  start_time, end_time, responsible_email, linked_group,
  source_name, observation, confidence, conflict_note, demand_code
) VALUES
  ('Sim', 'AGE-001', 'capture_external', 'Andreza', 'CAP DEZA', '2026-07-13', '09:00', '12:00', 'ampycaptacao@gmail.com', 'Andreza — ciclo 25/07 a 25/08', 'Google Agenda', 'DEZA provavelmente corresponde a Andreza.', 'Provável', 'Sem conflito confirmado', 'DEM-006'),
  ('Sim', 'AGE-002', 'meeting', 'Adv. Maiara', 'REU MAI', '2026-07-13', '13:30', '14:30', 'ampyplanejamento@gmail.com', 'Adv. Maiara — ciclo 15/06 a 31/07', 'Google Agenda', 'MAI provavelmente corresponde a Maiara.', 'Provável', 'Sobreposição de 30 min com CAP JG', 'DEM-020'),
  ('Sim', 'AGE-003', 'capture_external', 'JG Uniformes', 'CAP JG', '2026-07-13', '14:00', '16:00', 'ampycaptacao@gmail.com', 'JG Uniformes — ciclo 04/07 a 04/08', 'Google Agenda', NULL, 'Confirmado', 'Sobreposição de 30 min com REU MAI', 'DEM-024'),
  ('Sim', 'AGE-004', 'capture_external', 'AFAPV', 'CAP AFAPV', '2026-07-13', '16:00', '17:30', 'ampycaptacao@gmail.com', 'AFAPV — ciclo 15/06 a 15/07', 'Google Agenda', NULL, 'Confirmado', 'Sem sobreposição; começa quando CAP JG termina', 'DEM-005'),
  ('Sim', 'AGE-005', 'capture_studio', 'Ampy Digital', 'CAP AMPY', '2026-07-13', '19:00', '23:00', 'ampycaptacao@gmail.com', 'Interno Ampy — captação', 'Google Agenda', NULL, 'Confirmado', 'Sem conflito', 'DEM-040'),
  ('Sim com validação', 'AGE-006', 'capture_external', 'A validar', 'CAP JÚRI', '2026-07-14', '08:30', '09:30', 'ampycaptacao@gmail.com', NULL, 'Google Agenda', 'Cliente não identificado.', 'Precisa validar', 'Sem conflito', NULL),
  ('Sim', 'AGE-007', 'capture_external', 'Elite', 'CAP ELITE', '2026-07-14', '09:30', '12:00', 'ampycaptacao@gmail.com', 'Elite — ciclo 07/07 a 11/07', 'Google Agenda', NULL, 'Confirmado', 'Sobreposição com REU ISA entre 10:30 e 11:30', 'DEM-002'),
  ('Sim', 'AGE-008', 'meeting', 'Isa Psicóloga', 'REU ISA', '2026-07-14', '10:30', '11:30', 'ampyplanejamento@gmail.com', 'Isa Psicóloga — ciclo 09/07 a 31/07', 'Google Agenda', NULL, 'Provável', 'Sobreposição com CAP ELITE', 'DEM-031'),
  ('Sim', 'AGE-009', 'capture_external', 'Bufallo Couro', 'CAP BUFALLO', '2026-07-14', '15:30', '18:00', 'ampycaptacao@gmail.com', 'Bufallo Couro — ciclo 20/07 a 20/08', 'Google Agenda', NULL, 'Confirmado', 'Sem conflito visível', 'DEM-007'),
  ('Sim', 'AGE-010', 'capture_external', 'Hospital Veterinário IMAS', 'CAP IMAS + dep', '2026-07-15', '09:00', '11:00', 'ampycaptacao@gmail.com', 'IMAS — ciclo 15/07 a 16/08', 'Google Agenda', 'A sigla ''dep'' precisa ser esclarecida.', 'Confirmado', 'Sem conflito visível', 'DEM-014'),
  ('Sim', 'AGE-011', 'capture_external', 'Melp', 'CAP MELP', '2026-07-16', '09:00', '11:00', 'ampycaptacao@gmail.com', 'Melp — ciclo 19/07 a 19/08', 'Google Agenda', NULL, 'Confirmado', 'Sem conflito visível', 'DEM-003'),
  ('Sim', 'AGE-012', 'capture_external', 'New Face', 'CAP NEW FACE', '2026-07-16', '13:30', '15:00', 'ampycaptacao@gmail.com', NULL, 'Google Agenda', 'Não havia ciclo correspondente visível no quadro macro.', 'Confirmado', 'Sem conflito visível', NULL),
  ('Sim com validação', 'AGE-013', 'internal', 'A validar', 'OFICINA CROCHÊ', '2026-07-18', '09:00', '10:00', 'ampyprogramacao@gmail.com', NULL, 'Google Agenda', 'Cliente ou natureza interna não identificados.', 'Precisa validar', 'Sem conflito visível', NULL),
  ('Sim', 'AGE-014', 'capture_external', 'Maline Modas', 'CAP MALINE', '2026-07-20', '14:00', '17:00', 'ampycaptacao@gmail.com', 'Maline Modas — ciclo 29/06 a 22/07', 'Google Agenda', NULL, 'Confirmado', 'Sobreposição com RETORNO JU', 'DEM-021'),
  ('Sim com validação', 'AGE-015', 'internal', 'A validar', 'RETORNO JU', '2026-07-20', '14:20', '15:20', 'ampyprogramacao@gmail.com', NULL, 'Google Agenda', 'Pessoa ou cliente ''JU'' não identificado.', 'Precisa validar', 'Sobreposição com CAP MALINE', NULL),  ('Sim', 'AGE-016', 'capture_external', 'Isa Psicóloga', 'CAP ISA', '2026-07-21', '09:30', '11:30', 'ampycaptacao@gmail.com', 'Isa Psicóloga — ciclo 09/07 a 31/07', 'Google Agenda', NULL, 'Provável', 'Sem conflito visível', 'DEM-031'),
  ('Sim', 'AGE-017', 'capture_external', 'Luana Arquiteta', 'CAP LUANA', '2026-07-21', '14:00', '17:00', 'ampycaptacao@gmail.com', 'Luana Arquiteta — ciclo 25/07 a 25/08', 'Google Agenda', 'Pode estar vinculada ao vídeo de tour.', 'Confirmado', 'Sem conflito visível', 'DEM-025'),
  ('Sim', 'AGE-018', 'internal', 'Ampy Digital', 'MOMENTO AMPY', '2026-07-31', '15:00', '18:00', 'ampyprogramacao@gmail.com', NULL, 'Google Agenda', NULL, 'Confirmado', 'Sem conflito visível', NULL),
  ('Sim', 'AGE-019', 'meeting', 'Maline Modas', 'REU MALINE', '2026-08-05', '11:00', '12:00', 'ampyplanejamento@gmail.com', 'Maline Modas — ciclo 29/06 a 22/07', 'Google Agenda', NULL, 'Confirmado', 'Sem conflito visível', 'DEM-021'),
  ('Sim', 'AGE-021', 'capture_external', 'Maline Modas', 'CAP MALINE (Best Seller)', '2026-08-10', '13:30', '16:30', 'ampycaptacao@gmail.com', 'Maline Modas — ciclo a revisar', 'Google Agenda', NULL, 'Confirmado', 'Sem conflito visível', 'DEM-021'),
  ('Sim', 'AGE-022', 'internal', 'Stylos Hair', 'EVENTO EXPERIENCE STYLOS', '2026-08-13', '09:00', '17:00', 'ampycaptacao@gmail.com', 'Stylos Hair — ciclo 02/07 a 11/08', 'Google Agenda', 'Evento de longa duração; confirmar equipe envolvida.', 'Confirmado', 'Sem conflito visível', 'DEM-028');

CREATE TEMP TABLE ampy_internal_client_names (name text PRIMARY KEY);

INSERT INTO ampy_internal_client_names (name) VALUES
  ('Ampy Digital'),
  ('Clientes padrão'),
  ('Geral'),
  ('A validar'),
  ('A validar — cliente semelhante a Hotel'),
  ('Cliente ilegível');

WITH requested_clients AS (
  SELECT DISTINCT client_name
  FROM ampy_import_demands
  WHERE client_name IS NOT NULL
  UNION
  SELECT DISTINCT client_name
  FROM ampy_import_agenda
  WHERE client_name IS NOT NULL
),
valid_clients AS (
  SELECT rc.client_name
  FROM requested_clients rc
  WHERE NOT EXISTS (
    SELECT 1
    FROM ampy_internal_client_names i
    WHERE pg_temp.ampy_norm(i.name) = pg_temp.ampy_norm(rc.client_name)
  )
),
matched_clients AS (
  SELECT vc.client_name
  FROM valid_clients vc
  WHERE EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE pg_temp.ampy_norm(c.name) = pg_temp.ampy_norm(vc.client_name)
       OR EXISTS (
         SELECT 1
         FROM ampy_client_aliases a
         WHERE pg_temp.ampy_norm(a.import_name) = pg_temp.ampy_norm(vc.client_name)
           AND pg_temp.ampy_norm(a.alias_name) = pg_temp.ampy_norm(c.name)
       )
  )
)
INSERT INTO public.clients (
  name, segment, status, responsible_id, notes, started_at,
  avatar_initials, avatar_color, avatar_bg
)
SELECT
  vc.client_name,
  '',
  'active',
  ctx.manager_id,
  '[AMPY-IMPORT-JIRA-AGENDA-2026-07] Cliente criado automaticamente para receber demandas importadas; revisar cadastro posteriormente.',
  current_date,
  upper(left(regexp_replace(vc.client_name, '[^A-Za-zÀ-ÿ ]', '', 'g'), 2)),
  '#475467',
  '#EEF2F7'
FROM valid_clients vc
CROSS JOIN ampy_import_context ctx
WHERE NOT EXISTS (
  SELECT 1 FROM matched_clients mc
  WHERE pg_temp.ampy_norm(mc.client_name) = pg_temp.ampy_norm(vc.client_name)
);

CREATE TEMP VIEW ampy_resolved_clients AS
SELECT
  names.client_name,
  (
    SELECT c.id
    FROM public.clients c
    LEFT JOIN ampy_client_aliases a
      ON pg_temp.ampy_norm(a.import_name) = pg_temp.ampy_norm(names.client_name)
     AND pg_temp.ampy_norm(a.alias_name) = pg_temp.ampy_norm(c.name)
    WHERE pg_temp.ampy_norm(c.name) = pg_temp.ampy_norm(names.client_name)
       OR a.import_name IS NOT NULL
    ORDER BY
      CASE
        WHEN pg_temp.ampy_norm(c.name) = pg_temp.ampy_norm(names.client_name) THEN 0
        ELSE 1
      END,
      c.name
    LIMIT 1
  ) AS client_id
FROM (
  SELECT DISTINCT client_name
  FROM ampy_import_demands
  WHERE client_name IS NOT NULL
  UNION
  SELECT DISTINCT client_name
  FROM ampy_import_agenda
  WHERE client_name IS NOT NULL
) names;

INSERT INTO public.work_items (
  title,
  description,
  client_id,
  client_service_id,
  type,
  origin,
  destino,
  status,
  priority,
  responsible_id,
  created_by,
  internal_deadline,
  final_deadline,
  drive_link,
  notes
)
SELECT
  d.title,
  d.description,
  rc.client_id,
  NULL,
  d.work_type,
  CASE WHEN rc.client_id IS NULL THEN 'internal' ELSE 'planned' END,
  'quadro',
  d.work_status,
  d.priority,
  COALESCE(tm.profile_id, ctx.manager_id),
  ctx.manager_id,
  NULL,
  d.final_deadline,
  d.drive_link,
  concat_ws(
    E'\n',
    '[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || d.code || ']',
    'Fonte: ' || coalesce(d.source_name, 'Jira'),
    CASE WHEN d.jira_id IS NOT NULL THEN 'ID Jira: ' || d.jira_id END,
    CASE WHEN d.original_period IS NOT NULL THEN 'Período original: ' || d.original_period END,
    CASE WHEN d.parent_group IS NOT NULL THEN 'Grupo/vínculo: ' || d.parent_group END,
    CASE WHEN d.tags_hours IS NOT NULL THEN 'Tags/horários: ' || d.tags_hours END,
    CASE WHEN d.confidence IS NOT NULL THEN 'Confiança: ' || d.confidence END,
    CASE WHEN d.review_note IS NOT NULL THEN 'Revisão posterior: ' || d.review_note END,
    CASE WHEN d.extra_notes IS NOT NULL THEN 'Observações: ' || d.extra_notes END,
    CASE WHEN rc.client_id IS NULL AND d.client_name IS NOT NULL
      THEN 'Cliente informado no print: ' || d.client_name
    END
  )
FROM ampy_import_demands d
CROSS JOIN ampy_import_context ctx
LEFT JOIN ampy_resolved_clients rc
  ON pg_temp.ampy_norm(rc.client_name) = pg_temp.ampy_norm(d.client_name)
LEFT JOIN public.team_members tm
  ON lower(tm.email) = lower(d.responsible_email)
WHERE d.import_flag <> 'Não'
  AND NOT EXISTS (
    SELECT 1
    FROM public.work_items w
    WHERE coalesce(w.notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || d.code || ']%'
  );

INSERT INTO public.work_item_history (
  work_item_id,
  actor_id,
  field_changed,
  old_value,
  new_value
)
SELECT
  w.id,
  ctx.manager_id,
  'created',
  NULL,
  'quadro'
FROM public.work_items w
CROSS JOIN ampy_import_context ctx
JOIN ampy_import_demands d
  ON coalesce(w.notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || d.code || ']%'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.work_item_history h
  WHERE h.work_item_id = w.id
    AND h.field_changed = 'created'
);

INSERT INTO public.calendar_events (
  title,
  type,
  client_id,
  work_item_id,
  responsible_id,
  starts_at,
  ends_at,
  all_day,
  color,
  recurrence_rule,
  location,
  notes,
  confirmed,
  drive_link,
  created_by
)
SELECT
  a.title,
  a.event_type,
  COALESCE(linked.client_id, rc.client_id),
  linked.id,
  COALESCE(tm.profile_id, ctx.manager_id),
  ((a.event_date + coalesce(a.start_time, time '09:00')) AT TIME ZONE 'America/Sao_Paulo'),
  ((a.event_date + coalesce(a.end_time, a.start_time, time '10:00')) AT TIME ZONE 'America/Sao_Paulo'),
  false,
  NULL,
  NULL,
  NULL,
  concat_ws(
    E'\n',
    '[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || a.code || ']',
    'Fonte: ' || coalesce(a.source_name, 'Google Agenda'),
    CASE WHEN a.observation IS NOT NULL THEN 'Observação: ' || a.observation END,
    CASE WHEN a.confidence IS NOT NULL THEN 'Confiança: ' || a.confidence END,
    CASE WHEN a.conflict_note IS NOT NULL THEN 'Conflito informado: ' || a.conflict_note END,
    CASE WHEN a.linked_group IS NOT NULL THEN 'Grupo/vínculo: ' || a.linked_group END,
    CASE WHEN COALESCE(linked.client_id, rc.client_id) IS NULL AND a.client_name IS NOT NULL
      THEN 'Cliente informado no print: ' || a.client_name
    END
  ),
  false,
  NULL,
  ctx.manager_id
FROM ampy_import_agenda a
CROSS JOIN ampy_import_context ctx
LEFT JOIN public.team_members tm
  ON lower(tm.email) = lower(a.responsible_email)
LEFT JOIN public.work_items linked
  ON a.demand_code IS NOT NULL
 AND coalesce(linked.notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || a.demand_code || ']%'
LEFT JOIN ampy_resolved_clients rc
  ON pg_temp.ampy_norm(rc.client_name) = pg_temp.ampy_norm(a.client_name)
WHERE a.import_flag <> 'Não'
  AND NOT EXISTS (
    SELECT 1
    FROM public.calendar_events ce
    WHERE coalesce(ce.notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || a.code || ']%'
  );

INSERT INTO public.work_item_history (
  work_item_id,
  actor_id,
  field_changed,
  old_value,
  new_value
)
SELECT
  ce.work_item_id,
  ctx.manager_id,
  'calendar_event_created',
  NULL,
  ce.title
FROM public.calendar_events ce
CROSS JOIN ampy_import_context ctx
JOIN ampy_import_agenda a
  ON coalesce(ce.notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:' || a.code || ']%'
WHERE ce.work_item_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.work_item_history h
    WHERE h.work_item_id = ce.work_item_id
      AND h.field_changed = 'calendar_event_created'
      AND h.new_value = ce.title
  );

DO $$
DECLARE
  imported_demands integer;
  imported_events integer;
BEGIN
  SELECT count(*)
  INTO imported_demands
  FROM public.work_items
  WHERE coalesce(notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:DEM-%';

  SELECT count(*)
  INTO imported_events
  FROM public.calendar_events
  WHERE coalesce(notes, '') LIKE '%[AMPY-IMPORT-JIRA-AGENDA-2026-07:AGE-%';

  RAISE NOTICE 'Demandas importadas/localizadas: %', imported_demands;
  RAISE NOTICE 'Agendas importadas/localizadas: %', imported_events;

  IF imported_demands < 57 THEN
    RAISE EXCEPTION 'Importação incompleta: esperadas 57 demandas, encontradas %.', imported_demands;
  END IF;

  IF imported_events < 21 THEN
    RAISE EXCEPTION 'Importação incompleta: esperadas 21 agendas, encontradas %.', imported_events;
  END IF;
END
$$;

COMMIT;