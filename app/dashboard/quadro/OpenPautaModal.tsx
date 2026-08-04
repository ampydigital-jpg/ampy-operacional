'use client'

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import {
  createPortal,
} from 'react-dom'

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

  const [
    existingPauta,
    setExistingPauta,
  ] = useState<any | null>(null)

  const [
    mounted,
    setMounted,
  ] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === 'Escape' &&
        !loading
      ) {
        onClose()
      }
    }

    window.addEventListener(
      'keydown',
      handleKeyDown,
    )

    return () => {
      document.body.style.overflow =
        previousOverflow

      window.removeEventListener(
        'keydown',
        handleKeyDown,
      )
    }
  }, [
    open,
    loading,
    onClose,
  ])

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
    setExistingPauta(null)
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

  if (!open || !mounted) return null

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
      'code' in result &&
      result.code === 'PAUTA_EXISTS' &&
      'pautaId' in result &&
      result.pautaId
    ) {
      setExistingPauta(result)
      setLoading(false)
      return
    }

    if (
      result &&
      'success' in result &&
      result.success === true &&
      'pautaId' in result &&
      result.pautaId
    ) {
      window.location.href =
        '/dashboard/pautas?board=' +
        boardId +
        '&pauta=' +
        result.pautaId

      return
    }

    setError(
      'A abertura não retornou um resultado válido.',
    )
    setLoading(false)
  }

  return createPortal(
    <div
      className="pauta-launch-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          if (!loading) {
            onClose()
          }
        }
      }}
    >
      <form
        className="pauta-launch-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-pauta-title"
        onSubmit={submit}
      >
        <header className="pauta-launch-header">
          <div className="pauta-launch-heading">
            <span className="pauta-launch-heading-icon">
              <i className="ti ti-calendar-plus" />
            </span>

            <div>
              <span className="pauta-launch-eyebrow">
                Operação mensal
              </span>

              <h2 id="open-pauta-title">
                Abrir nova Pauta
              </h2>

              <p>
                Defina a meta, revise a cobertura e escolha os clientes participantes.
              </p>
            </div>
          </div>

          <div className="pauta-launch-header-actions">
            <span className="pauta-launch-name">
              <i className="ti ti-wand" />
              {pautaName}
            </span>

            <button
              className="pauta-launch-close"
              type="button"
              onClick={onClose}
              disabled={loading}
              aria-label="Fechar"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </header>

        <div className="pauta-launch-content">
          <section className="pauta-launch-config">
            <div className="pauta-launch-section-head">
              <div>
                <span>Configuração</span>
                <strong>{formatMonthLabel(monthKey)}</strong>
              </div>

              <small>Nome automático</small>
            </div>

            <label className="pauta-launch-field">
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
                Mês acompanhado no Quadro Operacional.
              </small>
            </label>

            <div className="pauta-launch-date-grid">
              <label className="pauta-launch-date-card">
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

              <label className="pauta-launch-date-card">
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
              className="pauta-launch-coverage"
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

            <div className="pauta-launch-summary">
              <div className="pauta-launch-summary-head">
                <span>Resumo</span>
                <strong>{pautaName}</strong>
              </div>

              <div className="pauta-launch-metrics">
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

              <div className="pauta-launch-summary-dates">
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

            {existingPauta && (
              <div className="notice notice-warn pauta-launch-error pauta-existing-result">
                <i className="ti ti-calendar-check" />

                <div>
                  <strong>
                    {existingPauta.message ||
                      'Já existe uma Pauta para este mês.'}
                  </strong>

                  <span>
                    Nenhum card ou configuração da Pauta existente foi alterado.
                  </span>
                </div>

                <button
                  className="bpri"
                  type="button"
                  onClick={() => {
                    window.location.href =
                      '/dashboard/pautas?board=' +
                      boardId +
                      '&pauta=' +
                      existingPauta.pautaId
                  }}
                >
                  Abrir Pauta existente
                </button>
              </div>
            )}

            {error && (
              <div className="notice notice-err pauta-launch-error">
                <i className="ti ti-alert-circle" />
                <span>{error}</span>
              </div>
            )}
          </section>

          <section className="pauta-launch-clients">
            <div className="pauta-launch-clients-head">
              <div>
                <span>Clientes participantes</span>
                <strong>
                  {selectedClientIds.length} de {clients.length} selecionados
                </strong>
              </div>

              <label className="pauta-launch-select-all">
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

            <div className="sbox pauta-launch-search">
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

            <div className="pauta-launch-client-list">
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
                      className="pauta-launch-client"
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

                      <span className="pauta-launch-client-copy">
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

                      <span className="pauta-launch-client-state">
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
                <div className="pauta-launch-empty">
                  <i className="ti ti-search-off" />
                  <strong>Nenhum cliente encontrado</strong>
                  <span>Revise o termo usado na busca.</span>
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="pauta-launch-footer">
          <div className="pauta-launch-transaction">
            <i className="ti ti-shield-check" />

            <div>
              <strong>
                {selectedClientIds.length} cards serão criados em uma única operação.
              </strong>

              <span>
                Se qualquer cliente falhar, toda a abertura será cancelada.
              </span>
            </div>
          </div>

          <label className="pauta-launch-confirmation">
            <span>Confirme digitando ABRIR PAUTA</span>

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

          <div className="pauta-launch-actions">
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
    </div>,
    document.body,
  )
}
