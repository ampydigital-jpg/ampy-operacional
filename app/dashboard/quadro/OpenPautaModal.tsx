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
        className="modal pauta-open-modal pauta-open-modal-v3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-pauta-title"
        onClick={(event) =>
          event.stopPropagation()
        }
        onSubmit={submit}
      >
        <header className="pauta-open-v3-head">
          <div className="pauta-open-v3-title">
            <span className="pauta-open-v3-title-icon">
              <i className="ti ti-calendar-plus" />
            </span>

            <div>
              <h2 id="open-pauta-title">
                Abrir nova Pauta
              </h2>

              <p>
                Defina a meta do mês e escolha os clientes que participarão da operação.
              </p>
            </div>
          </div>

          <div className="pauta-open-v3-head-actions">
            <span className="pauta-open-v3-name-chip">
              <i className="ti ti-wand" />
              {pautaName}
            </span>

            <button
              className="mclose"
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Fechar"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </header>

        <div className="pauta-open-v3-steps" aria-hidden="true">
          <span className="active">
            <b>1</b>
            Configuração
          </span>

          <i />

          <span className="active">
            <b>2</b>
            Clientes
          </span>

          <i />

          <span>
            <b>3</b>
            Confirmação
          </span>
        </div>

        <div className="pauta-open-v3-body">
          <section className="pauta-open-v3-config">
            <div className="pauta-open-v3-section-title">
              <div>
                <span>Configuração mensal</span>
                <strong>{formatMonthLabel(monthKey)}</strong>
              </div>

              <small>Nome gerado automaticamente</small>
            </div>

            <label className="pauta-open-v3-field">
              <span>Mês de referência</span>

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
                Mês que será acompanhado no Quadro Operacional.
              </small>
            </label>

            <div className="pauta-open-v3-date-grid">
              <label className="pauta-open-v3-date-field">
                <span>
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
                  Prazo interno para concluir os clientes.
                </small>
              </label>

              <label className="pauta-open-v3-date-field">
                <span>
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
                  Cobertura mínima exigida para concluir.
                </small>
              </label>
            </div>

            <div
              className="pauta-open-v3-coverage"
              data-coverage={coverage.key}
            >
              <i
                className={
                  coverage.key === 'complete'
                    ? 'ti ti-circle-check'
                    : coverage.key === 'invalid'
                      ? 'ti ti-alert-triangle'
                      : coverage.key === 'extended'
                        ? 'ti ti-calendar-up'
                        : 'ti ti-chart-donut-2'
                }
              />

              <div>
                <strong>{coverage.label}</strong>
                <span>{coverage.detail}</span>
              </div>
            </div>

            <div className="pauta-open-v3-summary">
              <div className="pauta-open-v3-summary-head">
                <span>Resumo da abertura</span>
                <strong>{pautaName}</strong>
              </div>

              <div className="pauta-open-v3-metrics">
                <div>
                  <strong>{selectedClientIds.length}</strong>
                  <span>clientes</span>
                </div>

                <div>
                  <strong>{selectedSummary.alignment}</strong>
                  <span>reuniões</span>
                </div>

                <div>
                  <strong>{selectedSummary.capture}</strong>
                  <span>captações</span>
                </div>

                <div
                  data-warning={
                    selectedSummary.withoutServices > 0
                      ? 'true'
                      : 'false'
                  }
                >
                  <strong>{selectedSummary.withoutServices}</strong>
                  <span>sem serviço</span>
                </div>
              </div>

              <div className="pauta-open-v3-summary-dates">
                <span>
                  <i className="ti ti-target-arrow" />
                  Meta {formatDate(magicNumberDate)}
                </span>

                <span>
                  <i className="ti ti-calendar-check" />
                  Cobertura {formatDate(scheduledUntilDate)}
                </span>
              </div>
            </div>

            {error && (
              <div className="notice notice-err pauta-open-v3-error">
                <i className="ti ti-alert-circle" />
                <span>{error}</span>
              </div>
            )}
          </section>

          <section className="pauta-open-v3-clients">
            <div className="pauta-open-v3-clients-head">
              <div>
                <span>Clientes participantes</span>
                <strong>
                  {selectedClientIds.length} de {clients.length} selecionados
                </strong>
              </div>

              <label className="pauta-open-v3-select-all">
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

                Selecionar todos
              </label>
            </div>

            <div className="sbox pauta-open-v3-search">
              <i className="ti ti-search" />

              <input
                value={query}
                placeholder="Buscar cliente por nome"
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Limpar busca"
                >
                  <i className="ti ti-x" />
                </button>
              )}
            </div>

            <div className="pauta-open-v3-client-list">
              {filteredClients.map(
                (client: any) => {
                  const services =
                    servicesByClient.get(
                      String(client.id),
                    ) || []

                  const selected =
                    selectedClientIds.includes(
                      String(client.id),
                    )

                  return (
                    <label
                      className="pauta-open-v3-client"
                      data-selected={selected ? 'true' : 'false'}
                      key={client.id}
                      title={client.name}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
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
                            client.name || 'CL',
                          )
                            .slice(0, 2)
                            .toUpperCase()}
                      </span>

                      <span className="pauta-open-v3-client-copy">
                        <strong>{client.name}</strong>

                        <small
                          data-warning={
                            services.length === 0
                              ? 'true'
                              : 'false'
                          }
                        >
                          {services.length === 0
                            ? 'Sem serviço ativo'
                            : services.length === 1
                              ? '1 serviço ativo'
                              : services.length +
                                ' serviços ativos'}
                        </small>
                      </span>

                      <span className="pauta-open-v3-client-state">
                        <i
                          className={
                            selected
                              ? 'ti ti-circle-check-filled'
                              : 'ti ti-circle'
                          }
                        />
                      </span>
                    </label>
                  )
                },
              )}

              {filteredClients.length === 0 && (
                <div className="pauta-open-v3-empty">
                  <i className="ti ti-search-off" />
                  <strong>Nenhum cliente encontrado</strong>
                  <span>Revise o termo usado na busca.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="pauta-open-v3-foot">
          <div className="pauta-open-v3-transaction">
            <i className="ti ti-shield-check" />

            <div>
              <strong>
                {selectedClientIds.length} cards serão criados de uma só vez.
              </strong>

              <span>
                Se um cliente falhar, toda a abertura será cancelada.
              </span>
            </div>
          </div>

          <label className="pauta-open-v3-confirmation">
            <span>Digite ABRIR PAUTA</span>

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
          </label>

          <div className="pauta-open-v3-actions">
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
                selectedClientIds.length === 0 ||
                confirmation !== 'ABRIR PAUTA'
              }
            >
              {loading
                ? 'Abrindo...'
                : 'Abrir Pauta'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}
