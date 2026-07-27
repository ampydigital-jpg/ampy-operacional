'use client'

type RequirementType =
  | 'alignment_meeting'
  | 'capture'

function requirementLabel(
  type: RequirementType,
) {
  return type ===
    'alignment_meeting'
    ? {
        code: 'REU',
        title:
          'Reunião de alinhamento',
        icon:
          'ti ti-users',
      }
    : {
        code: 'CAP',
        title:
          'Captação',
        icon:
          'ti ti-camera',
      }
}

function requirementState(
  requirement: any,
) {
  const status =
    String(
      requirement?.status ||
      'pending',
    )

  if (status === 'completed') {
    return {
      key: 'completed',
      label: 'Realizada',
    }
  }

  if (status === 'confirmed') {
    return {
      key: 'confirmed',
      label: 'Confirmada',
    }
  }

  if (status === 'scheduled') {
    return {
      key: 'scheduled',
      label: 'Agendada',
    }
  }

  if (status === 'cancelled') {
    return {
      key: 'cancelled',
      label: 'Cancelada',
    }
  }

  return {
    key: 'pending',
    label: 'Pendente',
  }
}

function eventStart(
  requirement: any,
) {
  return (
    requirement
      ?.calendar_event
      ?.starts_at ||
    requirement?.scheduled_at ||
    null
  )
}

function eventDateKey(
  requirement: any,
  fallback?: string | null,
) {
  const value =
    eventStart(requirement) ||
    fallback ||
    ''

  return String(value).slice(0, 10)
}

function formatSchedule(
  requirement: any,
) {
  const value =
    eventStart(requirement)

  if (!value) {
    return 'Sem data definida'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Sem data definida'
  }

  return date.toLocaleString(
    'pt-BR',
    {
      timeZone:
        'America/Sao_Paulo',
      day:
        '2-digit',
      month:
        '2-digit',
      year:
        'numeric',
      hour:
        '2-digit',
      minute:
        '2-digit',
    },
  )
}

function safeCaptureType(
  requirement: any,
) {
  return [
    'cap_e',
    'cap_s',
  ].includes(
    String(
      requirement?.calendar_type ||
      '',
    ),
  )
    ? String(
        requirement.calendar_type,
      )
    : 'cap_e'
}

function agendaHref({
  item,
  requirement,
  type,
  activeBoardId,
  activePautaKey,
}: {
  item: any
  requirement: any
  type: RequirementType
  activeBoardId: string
  activePautaKey: string
}) {
  const calendarEventId =
    String(
      requirement
        ?.calendar_event_id ||
      requirement
        ?.calendar_event
        ?.id ||
      '',
    )

  const date =
    eventDateKey(
      requirement,
      item.internal_deadline,
    )

  const params =
    new URLSearchParams()

  params.set(
    'period',
    'day',
  )

  if (date) {
    params.set(
      'start',
      date,
    )
  }

  if (
    activePautaKey &&
    activePautaKey !== 'all' &&
    activePautaKey !== 'legacy'
  ) {
    params.set(
      'pauta',
      activePautaKey,
    )
  }

  let returnPath =
    '/dashboard/quadro?board=' +
    encodeURIComponent(
      activeBoardId,
    )

  if (activePautaKey) {
    returnPath +=
      '&pauta=' +
      encodeURIComponent(
        activePautaKey,
      )
  }

  returnPath +=
    '#work-item-' +
    item.id

  params.set(
    'return',
    returnPath,
  )

  if (calendarEventId) {
    params.set(
      'event',
      calendarEventId,
    )
  } else {
    params.set(
      'new',
      '1',
    )

    params.set(
      'work_item',
      item.id,
    )

    if (item.client_id) {
      params.set(
        'client',
        item.client_id,
      )
    }

    params.set(
      'type',
      type ===
        'alignment_meeting'
        ? 'reu_a'
        : safeCaptureType(
            requirement,
          ),
    )
  }

  return (
    '/dashboard/agenda?' +
    params.toString()
  )
}

function RequirementBlock({
  item,
  requirement,
  type,
  activeBoardId,
  activePautaKey,
}: {
  item: any
  requirement: any
  type: RequirementType
  activeBoardId: string
  activePautaKey: string
}) {
  const definition =
    requirementLabel(type)

  const state =
    requirementState(
      requirement,
    )

  const hasEvent =
    Boolean(
      requirement
        ?.calendar_event_id ||
      requirement
        ?.calendar_event
        ?.id,
    )

  return (
    <section
      className="cycle-agenda-panel-item"
      data-status={state.key}
    >
      <div className="cycle-agenda-panel-item-head">
        <span className="cycle-agenda-panel-icon">
          <i
            className={
              definition.icon
            }
          />
        </span>

        <div>
          <strong>
            {definition.title}
          </strong>

          <small>
            {definition.code}
            {' · '}
            {state.label}
          </small>
        </div>

        <span
          className="cycle-agenda-panel-state"
          data-status={state.key}
        >
          {state.label}
        </span>
      </div>

      <div className="cycle-agenda-panel-date">
        <i className="ti ti-calendar-time" />

        <span>
          {formatSchedule(
            requirement,
          )}
        </span>
      </div>

      {requirement
        ?.calendar_event
        ?.location && (
          <div className="cycle-agenda-panel-date">
            <i className="ti ti-map-pin" />

            <span>
              {
                requirement
                  .calendar_event
                  .location
              }
            </span>
          </div>
        )}

      <a
        className={
          hasEvent
            ? 'bsec cycle-agenda-panel-action'
            : 'bpri cycle-agenda-panel-action'
        }
        href={agendaHref({
          item,
          requirement,
          type,
          activeBoardId,
          activePautaKey,
        })}
      >
        <i
          className={
            hasEvent
              ? 'ti ti-calendar-search'
              : 'ti ti-calendar-plus'
          }
        />

        {hasEvent
          ? 'Abrir na Agenda'
          : type ===
              'alignment_meeting'
            ? 'Agendar reunião'
            : 'Agendar captação'}
      </a>
    </section>
  )
}

export default function CycleAgendaPanel({
  item,
  activeBoardId,
  activePautaKey,
  onClose,
}: {
  item: any
  activeBoardId: string
  activePautaKey: string
  onClose: () => void
}) {
  if (!item) return null

  const requirements =
    Array.isArray(
      item.schedule_requirements,
    )
      ? item.schedule_requirements
      : []

  const alignment =
    requirements.find(
      (requirement: any) =>
        requirement.requirement_type ===
        'alignment_meeting',
    ) || null

  const capture =
    requirements.find(
      (requirement: any) =>
        requirement.requirement_type ===
        'capture',
    ) || null

  return (
    <div
      className="modal-ov cycle-agenda-panel-ov"
      onClick={onClose}
    >
      <div
        className="modal cycle-agenda-panel"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">
              Agenda operacional
            </div>

            <div className="modal-sub">
              {item.title}
            </div>
          </div>

          <button
            className="mclose"
            type="button"
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="modal-body cycle-agenda-panel-body">
          {requirements.length === 0 ? (
            <div className="notice notice-warn">
              <i className="ti ti-alert-triangle" />

              <span>
                Esta demanda ainda não possui requisitos de reunião ou captação configurados.
              </span>
            </div>
          ) : (
            <div className="cycle-agenda-panel-grid">
              {alignment && (
                <RequirementBlock
                  item={item}
                  requirement={alignment}
                  type="alignment_meeting"
                  activeBoardId={
                    activeBoardId
                  }
                  activePautaKey={
                    activePautaKey
                  }
                />
              )}

              {capture && (
                <RequirementBlock
                  item={item}
                  requirement={capture}
                  type="capture"
                  activeBoardId={
                    activeBoardId
                  }
                  activePautaKey={
                    activePautaKey
                  }
                />
              )}
            </div>
          )}

          <div className="cycle-agenda-panel-note">
            <i className="ti ti-link" />

            <span>
              A Agenda é a fonte oficial. Alterações de data, confirmação ou exclusão atualizam automaticamente estas tags.
            </span>
          </div>
        </div>

        <div className="modal-foot">
          <button
            className="bsec"
            type="button"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
