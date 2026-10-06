export function isOperationalDemand(item: any) {
  return !item.is_pauta_card && !['archived', 'cancelled'].includes(String(item.status))
}

/** A denominator is the due-date cohort, not all created tasks or completion events. */
export function deliverySummary(items: any[], start: string, end: string) {
  const planned = items.filter(item => isOperationalDemand(item) &&
    item.final_deadline && item.final_deadline >= start && item.final_deadline < end)
  const done = planned.filter(item => Boolean(item.completed_at) || ['done', 'delivered', 'approved'].includes(item.status))
  return { planned, done, percent: planned.length ? Math.round(done.length / planned.length * 100) : 0 }
}
