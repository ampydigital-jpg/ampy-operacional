'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  generateNextWorkItemCyclesAction,
  prepareNextWorkItemCyclesAction,
} from '@/lib/actions'

type PreparedService = {
  id: string
  name: string
  cycleDurationDays: number
  requiresAlignmentMeeting: boolean
  requiresCapture: boolean
  defaultCaptureType: string | null
}

type PreparedRow = {
  sourceId: string
  title: string
  clientName?: string
  currentClientServiceId?: string | null
  finalDeadline?: string | null
  eligible: boolean
  reason?: string | null
  services: PreparedService[]
}

type EditableRow = PreparedRow & {
  clientServiceId: string
  startDate: string
  endDate: string
}

type GenerationResult = {
  sourceId: string
  success: boolean
  newId?: string
  title?: string
  error?: string
}

function validDate(value?: string | null) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
}

function addDays(date: string, days: number) {
  if (!validDate(date)) return ''
  const value = new Date(date + 'T12:00:00Z')
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function saoPauloToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const read = (type: 'year' | 'month' | 'day') =>
    parts.find((part) => part.type === type)?.value || ''

  return read('year') + '-' + read('month') + '-' + read('day')
}

function suggestedStart(finalDeadline?: string | null) {
  const today = saoPauloToday()
  const next = validDate(finalDeadline)
    ? addDays(String(finalDeadline), 1)
    : today
  return next > today ? next : today
}

function confirmationText(count: number) {
  return count === 1
    ? 'GERAR 1 CICLO'
    : 'GERAR ' + String(count) + ' CICLOS'
}

function captureLabel(type?: string | null) {
  if (type === 'cap_e') return 'Captação externa'
  if (type === 'cap_s') return 'Captação em estúdio'
  return 'Local definido no agendamento'
}

export default function NextCycleGeneratorModal({
  open,
  items = [],
  onClose,
}: {
  open: boolean
  items: any[]
  onClose: () => void
}) {
  const [rows, setRows] = useState<EditableRow[]>([])
  const [preparing, setPreparing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [programmingVerified, setProgrammingVerified] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [results, setResults] = useState<GenerationResult[]>([])

  const sourceKey = useMemo(
    () => items.map((item) => item.id).join('|'),
    [items],
  )

  useEffect(() => {
    if (!open) {
      setRows([])
      setPreparing(false)
      setLoading(false)
      setError('')
      setProgrammingVerified(false)
      setConfirmation('')
      setResults([])
      return
    }

    let active = true
    setPreparing(true)
    setError('')
    setResults([])
    setProgrammingVerified(false)
    setConfirmation('')

    prepareNextWorkItemCyclesAction(items.map((item) => item.id))
      .then((result: any) => {
        if (!active) return

        if (result && 'error' in result) {
          setError(
            result.error ||
              'Não foi possível preparar os ciclos.',
          )
          setRows([])
          return
        }

        const preparedRows = Array.isArray(result?.rows)
          ? (result.rows as PreparedRow[])
          : []

        setRows(
          preparedRows.map((row) => {
            const preferred =
              row.services.find(
                (service) =>
                  service.id === row.currentClientServiceId,
              ) ||
              row.services[0] ||
              null

            const startDate = suggestedStart(row.finalDeadline)

            return {
              ...row,
              clientServiceId: preferred?.id || '',
              startDate: row.eligible ? startDate : '',
              endDate:
                row.eligible && preferred
                  ? addDays(
                      startDate,
                      preferred.cycleDurationDays,
                    )
                  : '',
            }
          }),
        )
      })
      .catch((caught) => {
        if (!active) return
        setError(
          caught instanceof Error
            ? caught.message
            : 'Não foi possível preparar os ciclos.',
        )
      })
      .finally(() => {
        if (active) setPreparing(false)
      })

    return () => {
      active = false
    }
  }, [open, sourceKey])

  const eligibleRows = useMemo(
    () => rows.filter((row) => row.eligible),
    [rows],
  )

  const expectedConfirmation = confirmationText(
    eligibleRows.length,
  )

  const allRowsValid =
    eligibleRows.length > 0 &&
    eligibleRows.every(
      (row) =>
        Boolean(row.clientServiceId) &&
        validDate(row.startDate) &&
        validDate(row.endDate) &&
        row.endDate > row.startDate,
    )

  function updateRow(
    sourceId: string,
    patch: Partial<EditableRow>,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.sourceId === sourceId
          ? { ...row, ...patch }
          : row,
      ),
    )
  }

  function changeService(
    row: EditableRow,
    serviceId: string,
  ) {
    const service =
      row.services.find((item) => item.id === serviceId) ||
      null

    updateRow(row.sourceId, {
      clientServiceId: serviceId,
      endDate:
        service && validDate(row.startDate)
          ? addDays(
              row.startDate,
              service.cycleDurationDays,
            )
          : '',
    })
  }

  function changeStart(
    row: EditableRow,
    startDate: string,
  ) {
    const service =
      row.services.find(
        (item) => item.id === row.clientServiceId,
      ) || null

    updateRow(row.sourceId, {
      startDate,
      endDate:
        service && validDate(startDate)
          ? addDays(
              startDate,
              service.cycleDurationDays,
            )
          : row.endDate,
    })
  }

  async function submit() {
    if (loading || !allRowsValid) return

    setLoading(true)
    setError('')
    setResults([])

    const result: any =
      await generateNextWorkItemCyclesAction({
        items: eligibleRows.map((row) => ({
          sourceId: row.sourceId,
          clientServiceId: row.clientServiceId,
          startDate: row.startDate,
          endDate: row.endDate,
        })),
        programmingVerified,
        confirmation,
      })

    if (result && 'error' in result) {
      setError(
        result.error ||
          'Não foi possível gerar os ciclos.',
      )
      setLoading(false)
      return
    }

    setResults(
      Array.isArray(result?.results)
        ? result.results
        : [],
    )
    setLoading(false)
  }

  if (!open) return null

  return (
    <div
      className="modal-ov board-cycle-modal-ov"
      onClick={() => {
        if (!loading && results.length === 0) onClose()
      }}
    >
      <div
        className="modal board-cycle-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <div>
            <div className="mtitle">
              Gerar próximo ciclo
            </div>
            <div className="msub">
              Revise serviço e período antes de criar os novos cards.
            </div>
          </div>

          <button
            className="mclose"
            type="button"
            disabled={loading}
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </button>
        </div>

        <div className="modal-body board-cycle-modal-body">
          {preparing && (
            <div className="board-cycle-loading">
              <i className="ti ti-loader-2" />
              Preparando os ciclos...
            </div>
          )}

          {!preparing && (
            <>
              <div className="board-cycle-summary">
                <div>
                  <strong>{eligibleRows.length}</strong>
                  <span>ciclo(s) pronto(s)</span>
                </div>

                <div>
                  <strong>
                    {
                      rows.filter(
                        (row) => !row.eligible,
                      ).length
                    }
                  </strong>
                  <span>bloqueado(s)</span>
                </div>
              </div>

              <div className="board-cycle-review-list">
                {rows.map((row) => {
                  const service =
                    row.services.find(
                      (item) =>
                        item.id === row.clientServiceId,
                    ) || null

                  const result =
                    results.find(
                      (item) =>
                        item.sourceId === row.sourceId,
                    ) || null

                  return (
                    <section
                      className={
                        row.eligible
                          ? 'board-cycle-review-row'
                          : 'board-cycle-review-row is-blocked'
                      }
                      key={row.sourceId}
                    >
                      <div className="board-cycle-review-head">
                        <div>
                          <strong>
                            {row.clientName || 'Cliente'}
                          </strong>
                          <span>{row.title}</span>
                        </div>

                        {result && (
                          <span
                            className={
                              result.success
                                ? 'board-cycle-result success'
                                : 'board-cycle-result error'
                            }
                          >
                            {result.success
                              ? 'Gerado'
                              : 'Falhou'}
                          </span>
                        )}
                      </div>

                      {!row.eligible ? (
                        <div className="notice notice-warn board-cycle-blocked">
                          <i className="ti ti-alert-triangle" />
                          <span>
                            {row.reason || 'Card bloqueado.'}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="board-cycle-fields">
                            <div className="fg">
                              <label className="fl">
                                Serviço *
                              </label>
                              <select
                                className="fi"
                                value={row.clientServiceId}
                                disabled={
                                  loading ||
                                  results.length > 0
                                }
                                onChange={(event) =>
                                  changeService(
                                    row,
                                    event.target.value,
                                  )
                                }
                              >
                                <option value="">
                                  Selecione
                                </option>

                                {row.services.map((item) => (
                                  <option
                                    key={item.id}
                                    value={item.id}
                                  >
                                    {item.name} —{' '}
                                    {item.cycleDurationDays}{' '}
                                    dias
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="fg">
                              <label className="fl">
                                Início *
                              </label>
                              <input
                                className="fi"
                                type="date"
                                value={row.startDate}
                                disabled={
                                  loading ||
                                  results.length > 0
                                }
                                onChange={(event) =>
                                  changeStart(
                                    row,
                                    event.target.value,
                                  )
                                }
                              />
                            </div>

                            <div className="fg">
                              <label className="fl">
                                Final *
                              </label>
                              <input
                                className="fi"
                                type="date"
                                min={
                                  row.startDate || undefined
                                }
                                value={row.endDate}
                                disabled={
                                  loading ||
                                  results.length > 0
                                }
                                onChange={(event) =>
                                  updateRow(row.sourceId, {
                                    endDate:
                                      event.target.value,
                                  })
                                }
                              />
                            </div>
                          </div>

                          {service && (
                            <div className="board-cycle-requirements">
                              <span>
                                <i className="ti ti-calendar-event" />
                                {service.requiresAlignmentMeeting
                                  ? 'Reunião obrigatória'
                                  : 'Sem reunião obrigatória'}
                              </span>

                              <span>
                                <i className="ti ti-camera" />
                                {service.requiresCapture
                                  ? captureLabel(
                                      service.defaultCaptureType,
                                    )
                                  : 'Sem captação obrigatória'}
                              </span>
                            </div>
                          )}

                          {result?.success && (
                            <div className="notice notice-ok">
                              <i className="ti ti-check" />
                              <span>
                                {result.title ||
                                  'Novo ciclo criado.'}
                              </span>
                            </div>
                          )}

                          {result && !result.success && (
                            <div className="notice notice-err">
                              <i className="ti ti-alert-circle" />
                              <span>
                                {result.error ||
                                  'Falha ao gerar este ciclo.'}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                  )
                })}
              </div>

              {eligibleRows.length > 0 &&
                results.length === 0 && (
                  <div className="board-cycle-confirmation">
                    <label className="board-cycle-programming-check">
                      <input
                        type="checkbox"
                        checked={programmingVerified}
                        disabled={loading}
                        onChange={(event) =>
                          setProgrammingVerified(
                            event.target.checked,
                          )
                        }
                      />

                      <span>
                        Confirmo que a programação dos ciclos selecionados foi concluída.
                      </span>
                    </label>

                    <div className="fg">
                      <label className="fl">
                        Confirmação de segurança
                      </label>

                      <input
                        className="fi"
                        value={confirmation}
                        disabled={loading}
                        onChange={(event) =>
                          setConfirmation(
                            event.target.value,
                          )
                        }
                        placeholder={expectedConfirmation}
                        autoComplete="off"
                      />

                      <small>
                        Digite exatamente:{' '}
                        <b>{expectedConfirmation}</b>
                      </small>
                    </div>
                  </div>
                )}

              {error && (
                <div className="notice notice-err">
                  <i className="ti ti-alert-circle" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-foot">
          {results.length > 0 ? (
            <button
              className="bpri"
              type="button"
              onClick={() => window.location.reload()}
            >
              Atualizar Quadro
            </button>
          ) : (
            <>
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
                type="button"
                disabled={
                  preparing ||
                  loading ||
                  !allRowsValid ||
                  !programmingVerified ||
                  confirmation !== expectedConfirmation
                }
                onClick={submit}
              >
                {loading
                  ? 'Gerando...'
                  : 'Gerar ' +
                    String(eligibleRows.length) +
                    ' ciclo(s)'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
