import { unstable_noStore as noStore } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { dateKeyInAmpyTimezone } from '@/lib/date'
import {
  addDays,
  assignmentIsDone,
  eventDateKey,
  isEventDone,
  isOpen,
  loadOperationData,
  startOfWeek,
  ymd,
} from '../dashboard-data'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SemanaEquipePage() {
  noStore()
  const supabase = createClient()
  const todayKey = dateKeyInAmpyTimezone()
  const start = startOfWeek(new Date(`${todayKey}T12:00:00`))
  const end = addDays(start, 7)
  const startKey = ymd(start)
  const endKey = ymd(end)
  const source = await loadOperationData(supabase, { eventStartKey: startKey, eventEndKey: endKey })
  const profiles = source.profiles.filter((profile: any) => profile.is_active !== false)
  const demands = source.demands.filter((item: any) =>
    !item.is_pauta_card && isOpen(item) && item.final_deadline >= startKey && item.final_deadline < endKey,
  )
  const events = source.events
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index))

  return (
    <div className="page-wrap ops-page semana-v9-page">
      <div className="topbar">
        <div>
          <div className="tb-title">Semana da equipe</div>
          <div className="tb-sub">{start.toLocaleDateString('pt-BR')} — {addDays(end, -1).toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <div className="semana-v9-metrics">
        <div><strong>{profiles.length}</strong><span>Membros ativos</span></div>
        <div><strong>{demands.length}</strong><span>Demandas abertas</span></div>
        <div><strong>{source.assignments.filter(assignmentIsDone).length}</strong><span>Etapas concluídas</span></div>
        <div><strong>{events.filter(isEventDone).length}/{events.length}</strong><span>Agendas realizadas</span></div>
      </div>

      <div className="semana-v9-team-list">
        {profiles.map((profile: any) => {
          const memberDemands = demands.filter((item: any) => item.responsible_id === profile.id)
          const memberEvents = events.filter((event: any) => event.responsible_id === profile.id)
          if (!memberDemands.length && !memberEvents.length) return null

          return (
            <section className="semana-v9-member" key={profile.id}>
              <header>
                <span className="semana-v9-avatar">{profile.avatar_initials || 'AM'}</span>
                <div>
                  <strong>{profile.display_name || profile.full_name}</strong>
                  <small>{memberDemands.length} demanda(s) · {memberEvents.length} agenda(s)</small>
                </div>
              </header>

              <div className="semana-v9-days">
                {days.map((day) => {
                  const key = ymd(day)
                  const dayDemands = memberDemands.filter((item: any) => item.final_deadline === key)
                  const dayEvents = memberEvents.filter((event: any) => eventDateKey(event) === key)
                  return (
                    <article key={key} data-today={key === todayKey ? 'true' : 'false'}>
                      <h3>{day.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' })}</h3>
                      {dayDemands.map((item: any) => (
                        <div className="semana-v9-demand" key={item.id}>
                          <strong>{item.title}</strong>
                          <span>{item.client?.name || 'Interno Ampy'}</span>
                        </div>
                      ))}
                      {dayEvents.map((event: any) => (
                        <div className="semana-v9-event" data-completed={isEventDone(event) ? 'true' : 'false'} key={event.id}>
                          <strong>{event.title}</strong>
                          <span>{isEventDone(event) ? 'Concluída' : 'Agendada'}</span>
                        </div>
                      ))}
                      {!dayDemands.length && !dayEvents.length && <span className="semana-v9-empty">—</span>}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
