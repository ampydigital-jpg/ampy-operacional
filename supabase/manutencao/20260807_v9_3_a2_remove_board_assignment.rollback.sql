-- ROLLBACK V9.3-A2
drop function if exists
  public.remove_work_item_board_assignment(
    uuid,
    text
  );
