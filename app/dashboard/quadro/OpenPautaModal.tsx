'use client'

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  openMonthlyPautaAction,
} from '@/lib/actions'

function currentMonthKey() {
  const date = new Date()

  return (
    String(date.getFullYear()) +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0')
  )
}

function referenceDate(
  monthKey: string,
) {
  return monthKey + '-01'
}

function parseMonthKey(
  monthKey: string,
) {
  const [
    year,
    month,
  ] = monthKey
    .split('-')
    .map(Number)

  return {
    year,
    month,
  }
}

function dateKey(
  year: number,
  monthIndex: number,
  day: number,
) {
  const date =
    new Date(
      year,
      monthIndex,
      day,
      12,
      0,
      0,
      0,
    )

  return (
    String(date.getFullYear()) +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  )
}

function formatPautaName(
  monthKey: string,
) {
  const date =
    new Date(
      referenceDate(monthKey) +
        'T12:00:00',
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Nova Pauta'
  }

  const label =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        month: 'long',
        year: 'numeric',
      },
    ).format(date)

  return (
    'Pauta ' +
    label.charAt(0).toUpperCase() +
    label.slice(1)
  )
}

function formatMonthLabel(
  monthKey: string,
) {
  const date =
    new Date(
      referenceDate(monthKey) +
        'T12:00:00',
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Mês inválido'
  }

  const label =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        month: 'long',
        year: 'numeric',
      },
    ).format(date)

  return (
    label.charAt(0).toUpperCase() +
    label.slice(1)
  )
}

function formatDate(
  value: string,
) {
  if (!value) return '--/--/----'

  const date =
    new Date(
      value +
        'T12:00:00',
    )

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '--/--/----'
  }

  return date.toLocaleDateString(
    'pt-BR',
  )
}

function suggestedDates(
  monthKey: string,
) {
  const {
    year,
    month,
  } = parseMonthKey(
    monthKey,
  )

  if (
    !year ||
    !month
  ) {
    return {
      magicNumberDate: '',
      scheduledUntilDate: '',
    }
  }

  return {
    magicNumberDate:
      dateKey(
        year,
        month - 2,
        25,
      ),

    scheduledUntilDate:
      dateKey(
        year,
        month - 1,
        10,
      ),
  }
}

function lastDayOfReferenceMonth(
  monthKey: string,
) {
  const {
    year,
    month,
  } = parseMonthKey(
    monthKey,
  )

  if (
    !year ||
    !month
  ) {
    return ''
  }

  return dateKey(
    year,
    month,
    0,
  )
}

function coverageStatus(
  monthKey: string,
  scheduledUntilDate: string,
) {
  const monthStart =
    referenceDate(monthKey)

  const monthEnd =
    lastDayOfReferenceMonth(
      monthKey,
    )

  if (
    !scheduledUntilDate ||
    scheduledUntilDate < monthStart
  ) {
    return {
      key: 'invalid',
      label:
        'A cobertura precisa alcançar o mês da Pauta.',
      detail:
        'Escolha uma data igual ou posterior ao primeiro dia do mês de referência.',
    }
  }

  if (
    scheduledUntilDate ===
    monthEnd
  ) {
    return {
      key: 'complete',
      label:
        'Cobertura mensal completa',
      detail:
        'A meta contempla todo o mês de referência.',
    }
  }

  if (
    scheduledUntilDate <
    monthEnd
  ) {
    return {
      key: 'partial',
      label:
        'Cobertura parcial do mês',
      detail:
        'A Pauta será concluída quando a programação estiver garantida até a data escolhida.',
    }
  }

  return {
    key: 'extended',
    label:
      'Cobertura além do mês',
    detail:
      'A meta ultrapassa o último dia do mês de referência.',
  }
}

export default function OpenPautaModal({
  open,
  boardId,
  clients = [],
  clientServices = [],
  onClose,
}: {
  open: boolean
  boardId: string
  clients: any[]
  clientServices?: any[]
  onClose: () => void
}) {
  const [
    monthKey,
    setMonthKey,
  ] = useState(
    currentMonthKey(),
  )

  const initialDates =
    suggestedDates(
      currentMonthKey(),
    )

  const [
    magicNumberDate,
    setMagicNumberDate,
  ] = useState(
    initialDates.magicNumberDate,
  )

  const [
    scheduledUntilDate,
    setScheduledUntilDate,
  ] = useState(
    initialDates.scheduledUntilDate,
  )

  const [
    selectedClientIds,
    setSelectedClientIds,
  ] = useState<string[]>([])

  const [
    query,
    setQuery,
  ] = useState('')

  const [
    confirmation,
    setConfirmation,
  ] = useState('')

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  useEffect(() => {
    if (!open) return

    const nextMonth =
      currentMonthKey()

    const nextDates =
      suggestedDates(
        nextMonth,
      )

    setMonthKey(
      nextMonth,
    )

    setMagicNumberDate(
      nextDates.magicNumberDate,
    )

    setScheduledUntilDate(
      nextDates.scheduledUntilDate,
    )

    setSelectedClientIds(
      clients
        .map(
          (client: any) =>
            String(
              client.id || '',
            ),
        )
        .filter(Boolean),
    )

    setQuery('')
    setConfirmation('')
    setError('')
    setLoading(false)
  }, [
    open,
    clients,
  ])

  const pautaName =
    useMemo(
      () =>
        formatPautaName(
          monthKey,
        ),
      [monthKey],
    )

  const coverage =
    useMemo(
      () =>
        coverageStatus(
          monthKey,
          scheduledUntilDate,
        ),
      [
        monthKey,
        scheduledUntilDate,
      ],
    )

  const servicesByClient =
    useMemo(() => {
      const map =
        new Map<
          string,
          any[]
        >()

      for (
        const service
        of Array.isArray(
          clientServices,
        )
          ? clientServices
          : []
      ) {
        const clientId =
          String(
            service?.client_id || '',
          )

        if (!clientId) continue

        const current =
          map.get(clientId) || []

        current.push(service)
        map.set(
          clientId,
          current,
        )
      }

      return map
    }, [clientServices])

  const filteredClients =
    useMemo(() => {
      const term =
        query
          .trim()
          .toLowerCase()

      if (!term) {
        return clients
      }

      return clients.filter(
        (client: any) =>
          String(
            client.name || '',
          )
            .toLowerCase()
            .includes(term),
      )
    }, [
      clients,
      query,
    ])

  const selectedSummary =
    useMemo(() => {
      let alignment = 0
      let capture = 0
      let withoutServices = 0

      for (
        const clientId
        of selectedClientIds
      ) {
        const services =
          servicesByClient.get(
            clientId,
          ) || []

        if (
          services.length === 0
        ) {
          withoutServices += 1
          continue
        }

        if (
          services.some(
            (service: any) =>
              service
                ?.requires_alignment_meeting !==
              false,
          )
        ) {
          alignment += 1
        }

        if (
          services.some(
            (service: any) =>
              service
                ?.requires_capture !==
              false,
          )
        ) {
          capture += 1
        }
      }

      return {
        alignment,
        capture,
        withoutServices,
      }
    }, [
      selectedClientIds,
      servicesByClient,
    ])

  if (!open) return null

  const allSelected =
    clients.length > 0 &&
    clients.every(
      (client: any) =>
        selectedClientIds.includes(
          String(client.id),
        ),
    )

  const datesInvalid =
    !magicNumberDate ||
    !scheduledUntilDate ||
    magicNumberDate >
      scheduledUntilDate ||
    coverage.key === 'invalid'

  function changeMonth(
    value: string,
  ) {
    setMonthKey(value)

    const nextDates =
      suggestedDates(value)

    setMagicNumberDate(
      nextDates.magicNumberDate,
    )

    setScheduledUntilDate(
      nextDates.scheduledUntilDate,
    )
  }

  function toggleClient(
    clientId: string,
    checked: boolean,
  ) {
    setSelectedClientIds(
      (current) =>
        checked
          ? current.includes(
              clientId,
            )
            ? current
            : [
                ...current,
                clientId,
              ]
          : current.filter(
              (id) =>
                id !== clientId,
            ),
    )
  }

  async function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (datesInvalid) {
      setError(
        coverage.key ===
          'invalid'
          ? coverage.label
          : 'Revise o Magic Number e a data Programado até.',
      )
      return
    }

    setLoading(true)
    setError('')

    const result =
      await openMonthlyPautaAction({
        boardId,
        referenceMonth:
          referenceDate(
            monthKey,
          ),
        magicNumberDate,
        scheduledUntilDate,
        clientIds:
          selectedClientIds,
        confirmation,
      })

    if (
      result &&
      'error' in result
    ) {
      setError(
        result.error ||
          'Não foi possível abrir a Pauta.',
      )

      setLoading(false)
      return
    }

    if (
      result &&
      'pautaId' in result &&
      result.pautaId
    ) {
      window.location.href =
        '/dashboard/quadro?board=' +
        boardId +
        '&pauta=' +
        result.pautaId

      return
    }

    setError(
      'A Pauta foi criada sem retornar um identificador.',
    )
    setLoading(false)
  }

  return (
    <div
      className="modal-ov pauta-open-modal-ov"
      onClick={onClose}
    >
      <form
        className="modal pauta-open-modal pauta-open-modal-v2"
        onClick={(event) =>
          event.stopPropagation()
        }
        onSubmit={submit}
      >
        <div className="modal-head pauta-open-modal-head">
          <div>
            <div className="modal-title">
              Abrir nova Pauta
            </div>

            <div className="modal-sub">
              Organize a produção do mês e crie um card mensal para cada cliente selecionado.
            </div>
          </div>

          <button
            className="mclose"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="modal-body pauta-open-modal-body pauta-open-modal-body-v2">
          <div className="pauta-open-definition">
            <div className="pauta-open-definition-icon">
              <i className="ti ti-calendar-stats" />
            </div>

            <div>
              <strong>
                A Pauta é a referência operacional do mês.
              </strong>

              <span>
                A produção pode começar no mês anterior. O Magic Number define o prazo interno e “Programado até” define a cobertura real exigida para concluir os clientes.
              </span>
            </div>
          </div>

          <div className="pauta-open-layout">
            <section className="pauta-open-setup-card">
              <div className="pauta-open-section-head">
                <div>
                  <span>1. Definição da Pauta</span>
                  <strong>{pautaName}</strong>
                </div>

                <span className="pauta-open-auto-name">
                  <i className="ti ti-wand" />
                  Nome automático
                </span>
              </div>

              <div className="pauta-open-month-field">
                <label className="fl">
                  Mês de referência
                </label>

                <input
                  className="fi"
                  type="month"
                  value={monthKey}
                  required
                  onChange={(event) =>
                    changeMonth(
                      event.target.value,
                    )
                  }
                />

                <small>
                  Mês de produção e publicação que será acompanhado no Quadro.
                </small>
              </div>

              <div className="pauta-open-date-grid-v2">
                <label className="pauta-open-date-card">
                  <span className="pauta-open-date-title">
                    <i className="ti ti-target-arrow" />
                    Magic Number
                  </span>

                  <input
                    className="fi"
                    type="date"
                    value={magicNumberDate}
                    required
                    onChange={(event) =>
                      setMagicNumberDate(
                        event.target.value,
                      )
                    }
                  />

                  <small>
                    Prazo interno para os cards chegarem a Concluído.
                  </small>
                </label>

                <label className="pauta-open-date-card">
                  <span className="pauta-open-date-title">
                    <i className="ti ti-calendar-check" />
                    Programado até
                  </span>

                  <input
                    className="fi"
                    type="date"
                    value={scheduledUntilDate}
                    required
                    min={referenceDate(monthKey)}
                    onChange={(event) =>
                      setScheduledUntilDate(
                        event.target.value,
                      )
                    }
                  />

                  <small>
                    Cobertura mínima de programação. Pode ser parcial ou mensal completa.
                  </small>
                </label>
              </div>

              <div
                className="pauta-open-coverage"
                data-coverage={coverage.key}
              >
                <i
                  className={
                    coverage.key ===
                    'complete'
                      ? 'ti ti-circle-check'
                      : coverage.key ===
                          'invalid'
                        ? 'ti ti-alert-triangle'
                        : 'ti ti-chart-donut-2'
                  }
                />

                <div>
                  <strong>
                    {coverage.label}
                  </strong>

                  <span>
                    {coverage.detail}
                  </span>
                </div>
              </div>

              <div className="pauta-open-summary-card">
                <div className="pauta-open-summary-head">
                  <span>Resumo da abertura</span>
                  <strong>{formatMonthLabel(monthKey)}</strong>
                </div>

                <div className="pauta-open-summary-grid">
                  <div>
                    <strong>
                      {selectedClientIds.length}
                    </strong>
                    <span>cards mensais</span>
                  </div>

                  <div>
                    <strong>
                      {selectedSummary.alignment}
                    </strong>
                    <span>reuniões previstas</span>
                  </div>

                  <div>
                    <strong>
                      {selectedSummary.capture}
                    </strong>
                    <span>captações previstas</span>
                  </div>

                  <div>
                    <strong>
                      {selectedSummary.withoutServices}
                    </strong>
                    <span>sem serviço ativo</span>
                  </div>
                </div>

                <div className="pauta-open-summary-dates">
                  <span>
                    <i className="ti ti-target-arrow" />
                    Meta em {formatDate(magicNumberDate)}
                  </span>

                  <span>
                    <i className="ti ti-calendar-check" />
                    Cobertura até {formatDate(scheduledUntilDate)}
                  </span>
                </div>
              </div>
            </section>

            <section className="pauta-open-clients pauta-open-clients-v2">
              <div className="pauta-open-clients-head">
                <div>
                  <span>2. Clientes participantes</span>

                  <strong>
                    {selectedClientIds.length}
                    {' '}de{' '}
                    {clients.length}
                    {' '}selecionado(s)
                  </strong>
                </div>

                <label className="checkbox-line pauta-open-select-all">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelectedClientIds(
                        event.target.checked
                          ? clients.map(
                              (client: any) =>
                                String(client.id),
                            )
                          : [],
                      )
                    }
                  />

                  Selecionar todos os ativos
                </label>
              </div>

              <div className="sbox pauta-open-search">
                <i className="ti ti-search" />

                <input
                  value={query}
                  placeholder="Buscar cliente"
                  onChange={(event) =>
                    setQuery(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="pauta-open-client-list pauta-open-client-list-v2">
                {filteredClients.map(
                  (client: any) => {
                    const services =
                      servicesByClient.get(
                        String(client.id),
                      ) || []

                    return (
                      <label
                        className="pauta-open-client pauta-open-client-v2"
                        key={client.id}
                        title={client.name}
                      >
                        <input
                          type="checkbox"
                          checked={selectedClientIds.includes(
                            String(client.id),
                          )}
                          onChange={(event) =>
                            toggleClient(
                              String(client.id),
                              event.target.checked,
                            )
                          }
                        />

                        <span
                          className="pauta-open-client-avatar"
                          style={{
                            color:
                              client.avatar_color ||
                              '#475569',
                            background:
                              client.avatar_bg ||
                              '#E2E8F0',
                          }}
                        >
                          {client.avatar_initials ||
                            String(
                              client.name ||
                              'CL',
                            )
                              .slice(0, 2)
                              .toUpperCase()}
                        </span>

                        <span className="pauta-open-client-copy">
                          <strong>
                            {client.name}
                          </strong>

                          <small
                            data-warning={
                              services.length ===
                              0
                                ? 'true'
                                : 'false'
                            }
                          >
                            {services.length ===
                            0
                              ? 'Sem serviço ativo'
                              : services.length ===
                                  1
                                ? '1 serviço ativo'
                                : services.length +
                                  ' serviços ativos'}
                          </small>
                        </span>
                      </label>
                    )
                  },
                )}

                {filteredClients.length ===
                  0 && (
                  <div className="empty compact">
                    Nenhum cliente encontrado.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="pauta-open-confirmation-card">
            <div>
              <span>3. Confirmação</span>
              <strong>
                {selectedClientIds.length} card(s) serão criados em uma única operação.
              </strong>
              <small>
                Se qualquer cliente falhar, toda a abertura será cancelada. Digite exatamente ABRIR PAUTA.
              </small>
            </div>

            <input
              className="fi"
              value={confirmation}
              placeholder="ABRIR PAUTA"
              autoComplete="off"
              onChange={(event) =>
                setConfirmation(
                  event.target.value,
                )
              }
            />
          </div>

          {error && (
            <div className="notice notice-err">
              <i className="ti ti-alert-circle" />

              <span>
                {error}
              </span>
            </div>
          )}
        </div>

        <div className="modal-foot pauta-open-modal-foot">
          <div className="pauta-open-footer-summary">
            <strong>{pautaName}</strong>
            <span>
              Magic Number {formatDate(magicNumberDate)} · Programado até {formatDate(scheduledUntilDate)}
            </span>
          </div>

          <div className="pauta-open-footer-actions">
            <button
              className="bsec"
              type="button"
              disabled={loading}
              onClick={onClose}
            >
              Cancelar
            </button>

            <button
              className="bpri"
              type="submit"
              disabled={
                loading ||
                datesInvalid ||
                selectedClientIds.length ===
                  0 ||
                confirmation !==
                  'ABRIR PAUTA'
              }
            >
              {loading
                ? 'Abrindo Pauta...'
                : 'Abrir Pauta'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
