-- AMPY DIGITAL — V17-A14
-- QUADRO COM COLUNAS TOTALMENTE EDITÁVEIS
-- Projeto: ampy-operacional

BEGIN;

CREATE TABLE IF NOT EXISTS public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#2563EB',
  operational_status text NOT NULL DEFAULT 'not_started',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_columns_name_check
    CHECK (char_length(trim(name)) BETWEEN 1 AND 60),
  CONSTRAINT board_columns_status_check
    CHECK (
      operational_status IN (
        'not_started',
        'in_progress',
        'waiting',
        'blocked',
        'in_review',
        'awaiting_approval',
        'approved',
        'scheduled',
        'delivered',
        'done',
        'cancelled',
        'archived'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS board_columns_name_unique
  ON public.board_columns (board_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS idx_board_columns_board_position
  ON public.board_columns (board_id, position);

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS board_column_id uuid
  REFERENCES public.board_columns(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_board_column_id
  ON public.work_items(board_column_id);

ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS board_columns_select_authenticated
  ON public.board_columns;

CREATE POLICY board_columns_select_authenticated
  ON public.board_columns
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS board_columns_insert_total
  ON public.board_columns;

CREATE POLICY board_columns_insert_total
  ON public.board_columns
  FOR INSERT
  TO authenticated
  WITH CHECK (public.app_has_total_access());

DROP POLICY IF EXISTS board_columns_update_total
  ON public.board_columns;

CREATE POLICY board_columns_update_total
  ON public.board_columns
  FOR UPDATE
  TO authenticated
  USING (public.app_has_total_access())
  WITH CHECK (public.app_has_total_access());

DROP POLICY IF EXISTS board_columns_delete_total
  ON public.board_columns;

CREATE POLICY board_columns_delete_total
  ON public.board_columns
  FOR DELETE
  TO authenticated
  USING (public.app_has_total_access());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.board_columns
  TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_board_default_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.board_columns (
    board_id,
    name,
    color,
    operational_status,
    position
  )
  VALUES
    (NEW.id, 'A fazer', '#64748B', 'not_started', 0),
    (NEW.id, 'Em andamento', '#2563EB', 'in_progress', 1),
    (NEW.id, 'Aguardando', '#CA8A04', 'waiting', 2),
    (NEW.id, 'Em revisão', '#7C3AED', 'in_review', 3),
    (NEW.id, 'Concluído', '#16A34A', 'done', 4)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_board_default_columns
  ON public.boards;

CREATE TRIGGER trg_seed_board_default_columns
AFTER INSERT ON public.boards
FOR EACH ROW
EXECUTE FUNCTION public.seed_board_default_columns();

DO $$
DECLARE
  v_board record;
BEGIN
  FOR v_board IN
    SELECT id
    FROM public.boards
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.board_columns
      WHERE board_id = v_board.id
    ) THEN
      INSERT INTO public.board_columns (
        board_id,
        name,
        color,
        operational_status,
        position
      )
      VALUES
        (v_board.id, 'Não iniciada', '#64748B', 'not_started', 0),
        (v_board.id, 'Em andamento', '#2563EB', 'in_progress', 1),
        (v_board.id, 'Aguardando', '#CA8A04', 'waiting', 2),
        (v_board.id, 'Bloqueada', '#DC2626', 'blocked', 3),
        (v_board.id, 'Em revisão', '#7C3AED', 'in_review', 4),
        (v_board.id, 'Ag. aprovação', '#EA580C', 'awaiting_approval', 5),
        (v_board.id, 'Programada', '#0891B2', 'scheduled', 6),
        (v_board.id, 'Concluída', '#16A34A', 'done', 7)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

UPDATE public.work_items wi
SET board_column_id = (
  SELECT bc.id
  FROM public.board_columns bc
  WHERE bc.board_id = wi.board_id
    AND bc.operational_status = CASE
      WHEN wi.status IN ('approved', 'delivered', 'done') THEN 'done'
      ELSE wi.status
    END
  ORDER BY bc.position, bc.created_at
  LIMIT 1
)
WHERE wi.board_id IS NOT NULL
  AND wi.board_column_id IS NULL
  AND wi.status NOT IN ('archived', 'cancelled');

CREATE OR REPLACE FUNCTION public.delete_board_column_move_cards(
  p_column_id uuid,
  p_target_column_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_id uuid;
  v_column_name text;
  v_target_board_id uuid;
  v_target_status text;
  v_columns_count integer;
  v_cards_count integer;
  v_cards_moved integer := 0;
BEGIN
  IF NOT public.app_has_total_access() THEN
    RAISE EXCEPTION
      'Acesso Total é obrigatório para excluir colunas.';
  END IF;

  SELECT board_id, name
  INTO v_board_id, v_column_name
  FROM public.board_columns
  WHERE id = p_column_id
  FOR UPDATE;

  IF v_board_id IS NULL THEN
    RAISE EXCEPTION 'Coluna não encontrada.';
  END IF;

  SELECT count(*)
  INTO v_columns_count
  FROM public.board_columns
  WHERE board_id = v_board_id;

  IF v_columns_count <= 1 THEN
    RAISE EXCEPTION
      'Não é possível excluir a última coluna do Quadro.';
  END IF;

  SELECT count(*)
  INTO v_cards_count
  FROM public.work_items
  WHERE board_column_id = p_column_id
    AND status NOT IN ('archived', 'cancelled');

  IF v_cards_count > 0 THEN
    IF p_target_column_id IS NULL THEN
      RAISE EXCEPTION
        'Escolha uma coluna de destino para os cards existentes.';
    END IF;

    SELECT board_id, operational_status
    INTO v_target_board_id, v_target_status
    FROM public.board_columns
    WHERE id = p_target_column_id
    FOR UPDATE;

    IF v_target_board_id IS NULL
      OR v_target_board_id <> v_board_id
      OR p_target_column_id = p_column_id THEN
      RAISE EXCEPTION
        'A coluna de destino deve pertencer ao mesmo Quadro.';
    END IF;

    UPDATE public.work_items
    SET
      board_column_id = p_target_column_id,
      board_id = v_board_id,
      status = v_target_status
    WHERE board_column_id = p_column_id;

    GET DIAGNOSTICS v_cards_moved = ROW_COUNT;
  END IF;

  DELETE FROM public.board_columns
  WHERE id = p_column_id;

  WITH ordered AS (
    SELECT
      id,
      row_number() OVER (
        ORDER BY position, created_at, id
      ) - 1 AS next_position
    FROM public.board_columns
    WHERE board_id = v_board_id
  )
  UPDATE public.board_columns bc
  SET
    position = ordered.next_position,
    updated_at = now()
  FROM ordered
  WHERE bc.id = ordered.id;

  RETURN jsonb_build_object(
    'success', true,
    'column', v_column_name,
    'cards_moved', v_cards_moved
  );
END;
$$;

REVOKE ALL
  ON FUNCTION public.delete_board_column_move_cards(uuid, uuid)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.delete_board_column_move_cards(uuid, uuid)
  TO authenticated;

COMMIT;

SELECT
  to_regclass('public.board_columns') AS board_columns_table,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_items'
      AND column_name = 'board_column_id'
  ) AS work_items_board_column_id,
  (
    SELECT count(*)
    FROM public.board_columns
  ) AS total_columns,
  to_regprocedure(
    'public.delete_board_column_move_cards(uuid,uuid)'
  ) AS delete_column_function;
