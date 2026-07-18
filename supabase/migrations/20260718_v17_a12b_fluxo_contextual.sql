-- AMPY DIGITAL — V17-A12B
-- FLUXO CONTEXTUAL DE QUADROS E PROJETOS
-- Projeto correto: Supabase ampy-operacional

BEGIN;

CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#2563EB',
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT boards_name_check CHECK (char_length(trim(name)) BETWEEN 2 AND 80),
  CONSTRAINT boards_status_check CHECK (status IN ('active', 'archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS boards_active_name_unique
  ON public.boards (lower(trim(name)))
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_boards_status
  ON public.boards(status);

ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS board_id uuid
  REFERENCES public.boards(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_items_board_id
  ON public.work_items(board_id);

CREATE OR REPLACE FUNCTION public.app_has_total_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    LEFT JOIN public.profiles p
      ON p.id = auth.uid()
    WHERE tm.is_active = true
      AND tm.access_type = 'total'
      AND (
        tm.profile_id = auth.uid()
        OR (
          p.email IS NOT NULL
          AND lower(tm.email) = lower(p.email)
        )
      )
  );
$$;

REVOKE ALL
  ON FUNCTION public.app_has_total_access()
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.app_has_total_access()
  TO authenticated;

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS boards_select_authenticated
  ON public.boards;

CREATE POLICY boards_select_authenticated
  ON public.boards
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS boards_insert_total
  ON public.boards;

CREATE POLICY boards_insert_total
  ON public.boards
  FOR INSERT
  TO authenticated
  WITH CHECK (public.app_has_total_access());

DROP POLICY IF EXISTS boards_update_total
  ON public.boards;

CREATE POLICY boards_update_total
  ON public.boards
  FOR UPDATE
  TO authenticated
  USING (public.app_has_total_access())
  WITH CHECK (public.app_has_total_access());

DROP POLICY IF EXISTS boards_delete_total
  ON public.boards;

CREATE POLICY boards_delete_total
  ON public.boards
  FOR DELETE
  TO authenticated
  USING (public.app_has_total_access());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.boards
  TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_board_preserve_demands(
  p_board_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board_name text;
  v_demands_preserved integer := 0;
BEGIN
  IF NOT public.app_has_total_access() THEN
    RAISE EXCEPTION
      'Acesso Total é obrigatório para excluir Quadros.';
  END IF;

  SELECT name
    INTO v_board_name
  FROM public.boards
  WHERE id = p_board_id
  FOR UPDATE;

  IF v_board_name IS NULL THEN
    RAISE EXCEPTION 'Quadro não encontrado.';
  END IF;

  UPDATE public.work_items
  SET board_id = NULL
  WHERE board_id = p_board_id;

  GET DIAGNOSTICS v_demands_preserved = ROW_COUNT;

  DELETE FROM public.boards
  WHERE id = p_board_id;

  RETURN jsonb_build_object(
    'success', true,
    'board', v_board_name,
    'demands_preserved', v_demands_preserved
  );
END;
$$;

REVOKE ALL
  ON FUNCTION public.delete_board_preserve_demands(uuid)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.delete_board_preserve_demands(uuid)
  TO authenticated;

DO $$
DECLARE
  v_board_id uuid;
  v_creator_id uuid;
BEGIN
  SELECT id
    INTO v_creator_id
  FROM public.profiles
  WHERE lower(email) = 'ampydigital@gmail.com'
  LIMIT 1;

  SELECT id
    INTO v_board_id
  FROM public.boards
  WHERE status = 'active'
  ORDER BY created_at
  LIMIT 1;

  IF v_board_id IS NULL THEN
    INSERT INTO public.boards (
      name,
      description,
      color,
      status,
      created_by
    )
    VALUES (
      'Operação Geral',
      'Quadro principal da operação Ampy.',
      '#2563EB',
      'active',
      v_creator_id
    )
    RETURNING id
      INTO v_board_id;
  END IF;

  UPDATE public.work_items
  SET board_id = v_board_id
  WHERE board_id IS NULL
    AND destino IN ('quadro', 'ambos', 'kanban')
    AND status NOT IN ('archived', 'cancelled');
END;
$$;

COMMIT;

SELECT
  to_regclass('public.boards') AS boards_table,
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_items'
      AND column_name = 'board_id'
  ) AS work_items_board_id,
  to_regprocedure('public.app_has_total_access()') AS access_function,
  (
    SELECT count(*)
    FROM public.team_members
    WHERE is_active = true
      AND access_type = 'total'
  ) AS total_access_members;
