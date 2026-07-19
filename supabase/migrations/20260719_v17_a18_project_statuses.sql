-- AMPY DIGITAL — V17-A18
-- STATUS PERSONALIZADOS POR PROJETO

BEGIN;

CREATE TABLE IF NOT EXISTS public.project_step_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL
    REFERENCES public.work_items(id)
    ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#64748B',
  behavior text NOT NULL DEFAULT 'pending',
  position integer NOT NULL DEFAULT 0,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT project_step_statuses_name_check
    CHECK (char_length(trim(name)) BETWEEN 1 AND 48),

  CONSTRAINT project_step_statuses_color_check
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),

  CONSTRAINT project_step_statuses_behavior_check
    CHECK (
      behavior IN (
        'pending',
        'active',
        'blocked',
        'done'
      )
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS
  project_step_statuses_name_unique
ON public.project_step_statuses (
  work_item_id,
  lower(trim(name))
)
WHERE is_archived = false;

CREATE INDEX IF NOT EXISTS
  idx_project_step_statuses_project_position
ON public.project_step_statuses (
  work_item_id,
  position
);

ALTER TABLE public.project_steps
  ADD COLUMN IF NOT EXISTS status_id uuid
  REFERENCES public.project_step_statuses(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
  idx_project_steps_status_id
ON public.project_steps(status_id);

ALTER TABLE public.project_step_statuses
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS
  project_step_statuses_select_authenticated
ON public.project_step_statuses;

CREATE POLICY
  project_step_statuses_select_authenticated
ON public.project_step_statuses
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS
  project_step_statuses_insert_authenticated
ON public.project_step_statuses;

CREATE POLICY
  project_step_statuses_insert_authenticated
ON public.project_step_statuses
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS
  project_step_statuses_update_authenticated
ON public.project_step_statuses;

CREATE POLICY
  project_step_statuses_update_authenticated
ON public.project_step_statuses
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS
  project_step_statuses_delete_authenticated
ON public.project_step_statuses;

CREATE POLICY
  project_step_statuses_delete_authenticated
ON public.project_step_statuses
FOR DELETE
TO authenticated
USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.project_step_statuses
TO authenticated;

CREATE OR REPLACE FUNCTION
  public.touch_project_step_statuses_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_touch_project_step_statuses_updated_at
ON public.project_step_statuses;

CREATE TRIGGER
  trg_touch_project_step_statuses_updated_at
BEFORE UPDATE
ON public.project_step_statuses
FOR EACH ROW
EXECUTE FUNCTION
  public.touch_project_step_statuses_updated_at();

CREATE OR REPLACE FUNCTION
  public.seed_project_step_statuses_for_work_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.destino IN ('projeto', 'ambos')
    AND NOT EXISTS (
      SELECT 1
      FROM public.project_step_statuses existing
      WHERE existing.work_item_id = NEW.id
        AND existing.is_archived = false
    )
  THEN
    INSERT INTO public.project_step_statuses (
      work_item_id,
      name,
      color,
      behavior,
      position
    )
    VALUES
      (
        NEW.id,
        'A fazer',
        '#64748B',
        'pending',
        0
      ),
      (
        NEW.id,
        'Em andamento',
        '#7C3AED',
        'active',
        1
      ),
      (
        NEW.id,
        'Aguardando',
        '#D97706',
        'blocked',
        2
      ),
      (
        NEW.id,
        'Concluído',
        '#16A34A',
        'done',
        3
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS
  trg_seed_project_step_statuses
ON public.work_items;

CREATE TRIGGER
  trg_seed_project_step_statuses
AFTER INSERT OR UPDATE OF destino
ON public.work_items
FOR EACH ROW
EXECUTE FUNCTION
  public.seed_project_step_statuses_for_work_item();

INSERT INTO public.project_step_statuses (
  work_item_id,
  name,
  color,
  behavior,
  position
)
SELECT
  wi.id,
  defaults.name,
  defaults.color,
  defaults.behavior,
  defaults.position
FROM public.work_items wi
CROSS JOIN (
  VALUES
    (
      'A fazer'::text,
      '#64748B'::text,
      'pending'::text,
      0
    ),
    (
      'Em andamento'::text,
      '#7C3AED'::text,
      'active'::text,
      1
    ),
    (
      'Aguardando'::text,
      '#D97706'::text,
      'blocked'::text,
      2
    ),
    (
      'Concluído'::text,
      '#16A34A'::text,
      'done'::text,
      3
    )
) AS defaults(
  name,
  color,
  behavior,
  position
)
WHERE wi.destino IN ('projeto', 'ambos')
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_step_statuses existing
    WHERE existing.work_item_id = wi.id
      AND existing.is_archived = false
  )
ON CONFLICT DO NOTHING;

UPDATE public.project_steps step
SET status_id = (
  SELECT status_definition.id
  FROM public.project_step_statuses status_definition
  WHERE
    status_definition.work_item_id =
      step.work_item_id
    AND status_definition.is_archived = false
    AND status_definition.behavior =
      CASE
        WHEN step.status IN (
          'done',
          'delivered',
          'approved'
        ) THEN 'done'

        WHEN step.status IN (
          'blocked',
          'waiting',
          'awaiting_approval'
        ) THEN 'blocked'

        WHEN step.status IN (
          'in_progress',
          'in_review',
          'scheduled'
        ) THEN 'active'

        ELSE 'pending'
      END
  ORDER BY
    status_definition.position,
    status_definition.created_at
  LIMIT 1
)
WHERE step.status_id IS NULL;

COMMIT;

SELECT
  to_regclass(
    'public.project_step_statuses'
  ) AS statuses_table,

  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'project_steps'
      AND column_name = 'status_id'
  ) AS project_steps_status_id,

  (
    SELECT count(*)
    FROM public.project_step_statuses
    WHERE is_archived = false
  ) AS active_statuses,

  (
    SELECT count(*)
    FROM public.project_steps
    WHERE status_id IS NOT NULL
  ) AS linked_steps;
