-- AMPY DIGITAL — ROLLBACK V17-A18
-- NÃO EXECUTAR APÓS O USO REAL SEM BACKUP.
-- REMOVE STATUS PERSONALIZADOS E O VÍNCULO DAS ETAPAS.

BEGIN;

DROP TRIGGER IF EXISTS
  trg_seed_project_step_statuses
ON public.work_items;

DROP FUNCTION IF EXISTS
  public.seed_project_step_statuses_for_work_item();

DROP TRIGGER IF EXISTS
  trg_touch_project_step_statuses_updated_at
ON public.project_step_statuses;

DROP FUNCTION IF EXISTS
  public.touch_project_step_statuses_updated_at();

ALTER TABLE public.project_steps
  DROP COLUMN IF EXISTS status_id;

DROP TABLE IF EXISTS
  public.project_step_statuses;

COMMIT;
