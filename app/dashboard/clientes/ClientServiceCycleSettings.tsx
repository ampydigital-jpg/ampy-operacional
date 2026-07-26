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
          'Erro ao salvar as regras da Pauta.',
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
          <i className="ti ti-calendar-stats" />

          Regras da Pauta
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
            : 'Configurar Pauta'}
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

          <input
            type="hidden"
            name="cycle_duration_days"
            value={
              service?.cycle_duration_days ||
              30
            }
          />

          <div className="client-service-pauta-note">
            <i className="ti ti-info-circle" />

            <span>
              Estas regras definem quais pendências de Agenda serão criadas para o cliente ao abrir uma nova Pauta.
            </span>
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
                : 'Salvar regras'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
