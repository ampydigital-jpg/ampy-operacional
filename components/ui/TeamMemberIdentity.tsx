type TeamIdentityMember = {
  full_name?: string | null
  display_name?: string | null
  avatar_url?: string | null
  job_title?: string | null
  operational_area?: string | null
  is_active?: boolean | null
}

function memberName(member: TeamIdentityMember) {
  return (
    String(member.display_name || '').trim() ||
    String(member.full_name || '').trim() ||
    'Integrante'
  )
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'AM'
  )
}

export function TeamMemberAvatar({
  member,
  size = 'md',
  className = '',
}: {
  member: TeamIdentityMember
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const name = memberName(member)

  return (
    <span
      className={
        'team-member-avatar ' +
        'size-' +
        size +
        (className ? ' ' + className : '')
      }
      aria-label={name}
      title={name}
    >
      {member.avatar_url ? (
        <img src={member.avatar_url} alt={name} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  )
}

export default function TeamMemberIdentity({
  member,
  size = 'md',
  showMeta = false,
  showInactive = true,
  className = '',
}: {
  member: TeamIdentityMember
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  showMeta?: boolean
  showInactive?: boolean
  className?: string
}) {
  const name = memberName(member)
  const fullName = String(member.full_name || '').trim()
  const displayName = String(member.display_name || '').trim()
  const differentName =
    Boolean(displayName && fullName) && displayName !== fullName

  return (
    <span
      className={
        'team-member-identity' +
        (className ? ' ' + className : '')
      }
    >
      <TeamMemberAvatar member={member} size={size} />

      <span className="team-member-identity-copy">
        <b>{name}</b>

        {showMeta ? (
          <small>
            {differentName
              ? fullName
              : member.job_title || 'Equipe Ampy'}
          </small>
        ) : null}
      </span>

      {showInactive && member.is_active === false ? (
        <span className="team-member-inactive-tag">Inativo</span>
      ) : null}
    </span>
  )
}
