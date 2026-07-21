'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { changeOwnPasswordAction } from '@/lib/team-access-actions'

type AccountData = {
  full_name: string
  email: string
  job_title: string | null
  access_type: string
  operational_area: string
  must_change_password: boolean
  last_password_change_at: string | null
}

function areaLabel(value: string) {
  const labels: Record<string, string> = {
    gestao_operacional: 'Gestão Operacional',
    gestao_administrativa: 'Gestão Administrativa',
    captacao: 'Captação',
    edicao: 'Edição',
    operacoes: 'Operações',
    planejamento: 'Planejamento',
    design: 'Design',
    performance: 'Performance',
  }

  return labels[value] || value || 'Não definida'
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Ainda não registrada'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Ainda não registrada'
  }

  return date.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function MinhaContaView({
  account,
}: {
  account: AccountData
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const forced =
    account.must_change_password ||
    searchParams.get('troca') === 'obrigatoria'

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setError('')
    setSuccess('')

    const result = await changeOwnPasswordAction(
      new FormData(event.currentTarget),
    )

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    event.currentTarget.reset()
    setSuccess('Senha alterada com sucesso.')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <div>
          <span className="eyebrow">CONTA E SEGURANÇA</span>
          <h1>Minha Conta</h1>
          <p>
            Consulte seu perfil e altere sua senha de acesso à plataforma.
          </p>
        </div>
      </header>

      {forced ? (
        <div className="notice notice-warn account-password-warning">
          <i className="ti ti-shield-lock" />
          <span>
            Sua senha atual é temporária. Faça a troca antes de
            continuar utilizando a plataforma.
          </span>
        </div>
      ) : null}

      <div className="account-grid">
        <section className="account-profile-card">
          <div className="account-avatar">
            {account.full_name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0])
              .join('')
              .toUpperCase()}
          </div>

          <div>
            <span className="eyebrow">PERFIL</span>
            <h2>{account.full_name}</h2>
            <p>{account.email}</p>
          </div>

          <dl>
            <div>
              <dt>Função</dt>
              <dd>{account.job_title || 'Não definida'}</dd>
            </div>

            <div>
              <dt>Área</dt>
              <dd>{areaLabel(account.operational_area)}</dd>
            </div>

            <div>
              <dt>Acesso</dt>
              <dd>
                {account.access_type === 'total'
                  ? 'Acesso Total'
                  : 'Acesso Operacional'}
              </dd>
            </div>

            <div>
              <dt>Última troca de senha</dt>
              <dd>{formatDateTime(account.last_password_change_at)}</dd>
            </div>
          </dl>
        </section>

        <section className="account-password-card">
          <div>
            <span className="eyebrow">SEGURANÇA</span>
            <h2>Alterar senha</h2>
            <p>
              Use uma senha exclusiva, com pelo menos 12 caracteres.
            </p>
          </div>

          <form onSubmit={submit}>
            <div className="fg">
              <label className="fl">Senha atual *</label>
              <input
                className="fi"
                type="password"
                name="current_password"
                autoComplete="current-password"
                required
              />
            </div>

            <div className="fg">
              <label className="fl">Nova senha *</label>
              <input
                className="fi"
                type="password"
                name="new_password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>

            <div className="fg">
              <label className="fl">Confirmar nova senha *</label>
              <input
                className="fi"
                type="password"
                name="confirm_password"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </div>

            <small className="field-help">
              A senha deve conter letra maiúscula, letra minúscula,
              número e caractere especial.
            </small>

            {error ? (
              <div className="notice notice-err">
                <i className="ti ti-alert-circle" />
                <span>{error}</span>
              </div>
            ) : null}

            {success ? (
              <div className="notice notice-ok">
                <i className="ti ti-circle-check" />
                <span>{success}</span>
              </div>
            ) : null}

            <button className="bpri" disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
