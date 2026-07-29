'use client'

// AMPY-V7-A3.4B — EDIÇÃO COMPLETA DE SERVIÇOS DO CLIENTE

import {
  useState,
  type FormEvent,
} from 'react'

import {
  removeClientServiceAction,
  updateClientServiceAction,
} from '@/lib/actions'

function serviceStatusLabel(
  status?: string | null,
) {
  const value =
    String(
      status || 'active',
    )

  if (value === 'active') {
    return 'Ativo'
  }

  if (value === 'paused') {
    return 'Pausado'
  }

  if (value === 'onboarding') {
    return 'Onboarding'
  }

  return 'Inativo'
}

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
  services = [],
  profiles = [],
}: {
  service: any
  services?: any[]
  profiles?: any[]
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
          'Erro ao salvar o serviço.',
      )

      setLoading(false)
      return
    }

    window.location.reload()
  }

  async function removeService() {
    const serviceName =
      service?.service?.name ||
      'este serviço'

    if (
      !confirm(
        'Remover ' +
          serviceName +
          ' deste cliente? ' +
          'Quando houver demandas vinculadas, o histórico será preservado.',
      )
    ) {
      return
    }

    setLoading(true)
    setError('')

    const result =
      await removeClientServiceAction(
        service.id,
      )

    if (
      result &&
      'error' in result
    ) {
      setError(
        result.error ||
          'Erro ao remover o serviço.',
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
          <i className="ti ti-activity" />

          {serviceStatusLabel(
            service?.status,
          )}
        </span>

        <span>
          <i className="ti ti-calendar-stats" />

          {service?.monthly_quantity
            ? String(
                service.monthly_quantity,
              ) +
              ' ' +
              (
                service.quantity_unit ||
                'entregas'
              ) +
              ' / mês'
            : 'Sem quantidade mensal'}
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
            setRequiresCapture(
              service?.requires_capture !== false,
            )
            setEditing(
              (current) =>
                !current,
            )
          }}
        >
          <i className="ti ti-edit" />

          {editing
            ? 'Fechar edição'
            : 'Editar serviço'}
        </button>
      </div>

      {editing && (
        <form
          className="client-service-cycle-form client-service-editor-form"
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

          <label className="fg">
            <span>
              Serviço
            </span>

            <select
              className="fi"
              name="service_catalog_id"
              defaultValue={
                service.service_catalog_id ||
                ''
              }
              required
            >
              <option value="">
                Selecione
              </option>

              {services.map(
                (item: any) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="fg">
            <span>
              Situação
            </span>

            <select
              className="fi"
              name="status"
              defaultValue={
                service.status ||
                'active'
              }
            >
              <option value="active">
                Ativo
              </option>

              <option value="paused">
                Pausado
              </option>

              <option value="onboarding">
                Onboarding
              </option>

              <option value="inactive">
                Inativo
              </option>
            </select>
          </label>

          <label className="fg">
            <span>
              Quantidade mensal
            </span>

            <input
              className="fi"
              name="monthly_quantity"
              type="number"
              min="0"
              step="1"
              defaultValue={
                service.monthly_quantity ??
                ''
              }
            />
          </label>

          <label className="fg">
            <span>
              Unidade
            </span>

            <input
              className="fi"
              name="quantity_unit"
              defaultValue={
                service.quantity_unit ||
                ''
              }
              placeholder="conteúdos, vídeos..."
            />
          </label>

          <label className="fg">
            <span>
              Responsável
            </span>

            <select
              className="fi"
              name="responsible_id"
              defaultValue={
                service.responsible_id ||
                ''
              }
            >
              <option value="">
                Não definido
              </option>

              {profiles.map(
                (profile: any) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.full_name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="fg">
            <span>
              Início do serviço
            </span>

            <input
              className="fi"
              name="started_at"
              type="date"
              defaultValue={
                String(
                  service.started_at ||
                  '',
                ).slice(
                  0,
                  10,
                )
              }
            />
          </label>

          <label className="fg">
            <span>
              Duração da Pauta
            </span>

            <div className="client-service-duration-input">
              <input
                className="fi"
                name="cycle_duration_days"
                type="number"
                min="1"
                max="365"
                step="1"
                defaultValue={
                  service.cycle_duration_days ||
                  28
                }
                required
              />

              <span>
                dias
              </span>
            </div>

            <small className="client-service-help">
              Período usado para organizar o acompanhamento operacional.
            </small>
          </label>

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
                checked={
                  requiresCapture
                }
                onChange={(
                  event,
                ) =>
                  setRequiresCapture(
                    event.target
                      .checked,
                  )
                }
              />

              Exigir captação
            </label>
          </div>

          <label className="fg">
            <span>
              Local padrão da captação
            </span>

            <select
              className="fi"
              name="default_capture_type"
              defaultValue={
                service.default_capture_type ||
                ''
              }
              disabled={
                !requiresCapture
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
          </label>

          <label className="fg client-service-editor-full">
            <span>
              Observações
            </span>

            <textarea
              className="fi"
              name="notes"
              rows={3}
              defaultValue={
                service.notes ||
                ''
              }
              placeholder="Informações operacionais do serviço"
            />
          </label>

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
              className="bsec danger-action"
              type="button"
              disabled={loading}
              onClick={
                removeService
              }
            >
              <i className="ti ti-trash" />

              Remover serviço
            </button>

            <div className="client-service-cycle-actions-main">
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
                  : 'Salvar serviço'}
              </button>
            </div>
          </div>
        </form>
      )}

      {!editing &&
        error && (
        <div className="notice notice-err">
          <i className="ti ti-alert-circle" />

          <span>
            {error}
          </span>
        </div>
      )}
    </div>
  )
}
