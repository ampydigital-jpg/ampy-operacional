'use client'

import {
  useState,
  type FormEvent,
} from 'react'

import {
  updateClientServiceAction,
} from '@/lib/actions'

function captureLabel(service: any) {
  if (
    service?.requires_capture === false
  ) {
    return 'Captação não exigida'
  }

  if (
    service?.default_capture_type === 'cap_e'
  ) {
    return 'Captação externa'
  }

  if (
    service?.default_capture_type === 'cap_s'
  ) {
    return 'Captação em estúdio'
  }

  return 'Captação obrigatória'
}

export default function ClientServiceCycleSettings({
  service,
}: {
  service: any
}) {
  const [
    editing,
    setEditing,
  ] = useState(false)

  const [
    loading,
    setLoading,
  ] = useState(false)

  const [
    error,
    setError,
  ] = useState('')

  const [
    requiresCapture,
    setRequiresCapture,
  ] = useState(
    service?.requires_capture !== false,
  )

  const durationLabel =
    service?.cycle_duration_days
      ? String(
          service.cycle_duration_days,
        ) + ' dias'
      : 'Duração pendente'

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setLoading(true)
    setError('')

    const result =
      await updateClientServiceAction(
        new FormData(
          event.currentTarget,
        ),
      )

    if (
      result &&
      'error' in result
    ) {
      setError(
        result.error ||
          'Erro ao salvar o ciclo.',
      )

      setLoading(false)
      return
    }

    window.location.reload()
  }

  return (
    <div className="client-service-cycle">
      <div className="client-service-cycle-summary">
        <span>
          <i className="ti ti-repeat" />

          {durationLabel}
        </span>

        <span>
          <i className="ti ti-calendar-event" />

          {service?.requires_alignment_meeting === false
            ? 'Reunião não exigida'
            : 'Reunião obrigatória'}
        </span>

        <span>
          <i className="ti ti-camera" />

          {captureLabel(service)}
        </span>

        <button
          className="text-button"
          type="button"
          onClick={() => {
            setError('')
            setEditing(
              (current) =>
                !current,
            )
          }}
        >
          <i className="ti ti-settings" />

          {editing
            ? 'Fechar'
            : 'Configurar ciclo'}
        </button>
      </div>

      {editing && (
        <form
          className="client-service-cycle-form"
          onSubmit={submit}
        >
          <input
            type="hidden"
            name="id"
            value={service.id}
          />

          <input
            type="hidden"
            name="cycle_settings_present"
            value="1"
          />

          <div className="fg">
            <label className="fl">
              Duração do ciclo
            </label>

            <div className="client-service-duration-input">
              <input
                className="fi"
                type="number"
                name="cycle_duration_days"
                min="1"
                max="365"
                required
                defaultValue={
                  service?.cycle_duration_days ||
                  30
                }
              />

              <span>dias</span>
            </div>

            <small className="client-service-help">
              A data poderá ser ajustada antes de gerar o próximo ciclo.
            </small>
          </div>

          <div className="client-service-cycle-options">
            <label className="checkbox-line">
              <input
                type="checkbox"
                name="requires_alignment_meeting"
                defaultChecked={
                  service?.requires_alignment_meeting !== false
                }
              />

              Exigir reunião de alinhamento
            </label>

            <label className="checkbox-line">
              <input
                type="checkbox"
                name="requires_capture"
                checked={requiresCapture}
                onChange={(event) =>
                  setRequiresCapture(
                    event.target.checked,
                  )
                }
              />

              Exigir captação
            </label>
          </div>

          <div className="fg">
            <label className="fl">
              Local padrão da captação
            </label>

            <select
              className="fi"
              name="default_capture_type"
              disabled={!requiresCapture}
              defaultValue={
                service?.default_capture_type ||
                ''
              }
            >
              <option value="">
                Escolher ao agendar
              </option>

              <option value="cap_e">
                Externa
              </option>

              <option value="cap_s">
                Em estúdio
              </option>
            </select>
          </div>

          {error && (
            <div className="notice notice-err">
              <i className="ti ti-alert-circle" />

              <span>
                {error}
              </span>
            </div>
          )}

          <div className="client-service-cycle-actions">
            <button
              className="bsec"
              type="button"
              disabled={loading}
              onClick={() =>
                setEditing(false)
              }
            >
              Cancelar
            </button>

            <button
              className="bpri"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Salvando...'
                : 'Salvar ciclo'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
