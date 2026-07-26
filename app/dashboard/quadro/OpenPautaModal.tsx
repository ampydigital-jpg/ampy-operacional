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
    String(
      date.getFullYear(),
    ) +
    '-' +
    String(
      date.getMonth() + 1,
    ).padStart(2, '0')
  )
}

function referenceDate(
  monthKey: string,
) {
  return monthKey + '-01'
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
    String(
      date.getFullYear(),
    ) +
    '-' +
    String(
      date.getMonth() + 1,
    ).padStart(2, '0') +
    '-' +
    String(
      date.getDate(),
    ).padStart(2, '0')
  )
}

function suggestedDates(
  monthKey: string,
) {
  const [
    year,
    month,
  ] = monthKey
    .split('-')
    .map(Number)

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

export default function OpenPautaModal({
  open,
  boardId,
  clients = [],
  onClose,
}: {
  open: boolean
  boardId: string
  clients: any[]
  onClose: () => void
}) {
  const [
    monthKey,
    setMonthKey,
  ] = useState(
    currentMonthKey(),
  )

  const [
    name,
    setName,
  ] = useState(
    formatPautaName(
      currentMonthKey(),
    ),
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

    setName(
      formatPautaName(
        nextMonth,
      ),
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

  if (!open) return null

  const allSelected =
    clients.length > 0 &&
    clients.every(
      (client: any) =>
        selectedClientIds.includes(
          client.id,
        ),
    )

  function changeMonth(
    value: string,
  ) {
    setMonthKey(value)
    setName(
      formatPautaName(value),
    )

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

    setLoading(true)
    setError('')

    const result =
      await openMonthlyPautaAction({
        boardId,
        name,
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
        className="modal pauta-open-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
        onSubmit={submit}
      >
        <div className="modal-head">
          <div>
            <div className="modal-title">
              Abrir nova Pauta
            </div>

            <div className="modal-sub">
              Crie um card mensal para cada cliente selecionado.
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

        <div className="modal-body pauta-open-modal-body">
          <div className="pauta-open-grid">
            <div className="fg pauta-open-name">
              <label className="fl">
                Nome da Pauta
              </label>

              <input
                className="fi"
                value={name}
                maxLength={120}
                required
                onChange={(event) =>
                  setName(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="fg">
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
            </div>

            <div className="fg">
              <label className="fl">
                Magic Number
              </label>

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
            </div>

            <div className="fg">
              <label className="fl">
                Programado até
              </label>

              <input
                className="fi"
                type="date"
                value={scheduledUntilDate}
                required
                onChange={(event) =>
                  setScheduledUntilDate(
                    event.target.value,
                  )
                }
              />
            </div>
          </div>

          <div className="pauta-open-clients">
            <div className="pauta-open-clients-head">
              <div>
                <strong>
                  Clientes participantes
                </strong>

                <span>
                  {selectedClientIds.length}
                  {' '}de{' '}
                  {clients.length}
                  {' '}selecionado(s)
                </span>
              </div>

              <label className="checkbox-line">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) =>
                    setSelectedClientIds(
                      event.target.checked
                        ? clients.map(
                            (
                              client:
                                any,
                            ) =>
                              client.id,
                          )
                        : [],
                    )
                  }
                />

                Todos os clientes ativos
              </label>
            </div>

            <div className="sbox pauta-open-search">
              <i className="ti ti-search" />

              <input
                value={query}
                placeholder="Buscar cliente."
                onChange={(event) =>
                  setQuery(
                    event.target.value,
                  )
                }
              />
            </div>

            <div className="pauta-open-client-list">
              {filteredClients.map(
                (client: any) => (
                  <label
                    className="pauta-open-client"
                    key={client.id}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClientIds.includes(
                        client.id,
                      )}
                      onChange={(event) =>
                        toggleClient(
                          client.id,
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

                    <strong>
                      {client.name}
                    </strong>
                  </label>
                ),
              )}

              {filteredClients.length ===
                0 && (
                <div className="empty compact">
                  Nenhum cliente encontrado.
                </div>
              )}
            </div>
          </div>

          <div className="pauta-open-rule">
            <i className="ti ti-shield-check" />

            <span>
              O sistema criará somente um card mensal por cliente nesta Pauta. A operação é transacional: qualquer erro cancela toda a abertura.
            </span>
          </div>

          <div className="fg">
            <label className="fl">
              Confirmação
            </label>

            <input
              className="fi"
              value={confirmation}
              placeholder="Digite ABRIR PAUTA"
              autoComplete="off"
              onChange={(event) =>
                setConfirmation(
                  event.target.value,
                )
              }
            />

            <small className="client-service-help">
              Digite exatamente ABRIR PAUTA para criar os cards.
            </small>
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

        <div className="modal-foot">
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
      </form>
    </div>
  )
}
