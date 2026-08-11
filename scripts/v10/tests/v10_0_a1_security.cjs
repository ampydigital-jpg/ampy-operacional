const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnv(file) {
  const env = {}
  const content = fs.readFileSync(file, 'utf8')

  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    const index = line.indexOf('=')
    if (index < 1) continue

    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

async function main() {
  const repo = path.resolve(__dirname, '..', '..', '..')
  const env = loadEnv(path.join(repo, '.env.local'))

  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || (!url.includes('127.0.0.1') && !url.includes('localhost'))) {
    throw new Error('ABORTADO: Supabase alvo nao e local.')
  }

  if (!anonKey || !serviceKey) {
    throw new Error('Chaves locais obrigatorias ausentes.')
  }

  const admin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const collaborator = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const marker = Date.now()
  const email = `v10-collaborator-${marker}@ampydigital.test`
  const password = `V10-${marker}-Aa1!`

  let userId = null
  let ownWorkItemId = null
  let unauthorizedInsertId = null
  let pautaEventId = null
  let assignmentEventId = null
  let calendarEventId = null
  let calendarHistoryId = null
  let originalTargetNotes = null
  let originalRole = null
  let originalEmail = null
  let failures = 0

  function check(name, pass, detail = '') {
    const result = pass ? 'PASS' : 'FAIL'
    console.log(`${result} - ${name}${detail ? ` - ${detail}` : ''}`)
    if (!pass) failures += 1
  }

  async function must(result, label) {
    if (result.error) {
      throw new Error(`${label}: ${result.error.message}`)
    }
    return result.data
  }

  try {
    console.log('')
    console.log('============================================')
    console.log('V10.0-A1 - COLLABORATOR + SERVICE ROLE')
    console.log('============================================')

    const target = await must(
      await admin
        .from('work_items')
        .select('id,title,client_id,notes')
        .eq('title', '[V10 TEST] Demanda Sintetica')
        .single(),
      'Demanda sintetica',
    )

    if (!target.client_id) {
      throw new Error('Demanda sintetica nao possui client_id.')
    }

    originalTargetNotes = target.notes

    const pauta = await must(
      await admin
        .from('pautas')
        .select('id,board_id')
        .eq('name', '[V10 TEST] Pauta Sintetica')
        .single(),
      'Pauta sintetica',
    )

    const member = await must(
      await admin
        .from('pauta_members')
        .select('id')
        .eq('pauta_id', pauta.id)
        .limit(1)
        .single(),
      'Pauta member',
    )

    const assignment = await must(
      await admin
        .from('work_item_board_assignments')
        .select('id,work_item_id,board_id,board_column_id')
        .eq('work_item_id', target.id)
        .eq('assignment_status', 'active')
        .limit(1)
        .single(),
      'Assignment sintetico',
    )

    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (created.error) throw created.error

    userId = created.data.user.id

    const profile = await must(
      await admin
        .from('profiles')
        .select('id,role,email')
        .eq('id', userId)
        .single(),
      'Profile collaborator',
    )

    originalRole = profile.role
    originalEmail = profile.email

    await must(
      await admin
        .from('profiles')
        .update({ role: 'collaborator', is_active: true })
        .eq('id', userId)
        .select('id'),
      'Preparar collaborator',
    )

    const login = await collaborator.auth.signInWithPassword({ email, password })
    if (login.error) throw login.error

    const foreignRead = await collaborator
      .from('work_items')
      .select('id')
      .eq('id', target.id)

    check(
      'Collaborator nao le demanda alheia',
      Boolean(foreignRead.error) ||
        !Array.isArray(foreignRead.data) ||
        foreignRead.data.length === 0,
    )

    const forbiddenNote = `[V10 SECURITY FORBIDDEN ${marker}]`

    const foreignUpdate = await collaborator
      .from('work_items')
      .update({ notes: forbiddenNote })
      .eq('id', target.id)
      .select('id')

    const foreignUpdateBlocked =
      Boolean(foreignUpdate.error) ||
      !Array.isArray(foreignUpdate.data) ||
      foreignUpdate.data.length === 0

    check('Collaborator nao altera demanda alheia', foreignUpdateBlocked)

    if (!foreignUpdateBlocked) {
      await admin
        .from('work_items')
        .update({ notes: originalTargetNotes })
        .eq('id', target.id)
    }

    const foreignClient = await collaborator
      .from('clients')
      .select('id')
      .eq('id', target.client_id)

    check(
      'Collaborator nao le cliente alheio',
      Boolean(foreignClient.error) ||
        !Array.isArray(foreignClient.data) ||
        foreignClient.data.length === 0,
    )

    const foreignInsert = await collaborator
      .from('work_items')
      .insert({
        title: `[V10 SECURITY] Foreign ${marker}`,
        destino: 'avulsa',
        client_id: target.client_id,
        responsible_id: userId,
        created_by: userId,
      })
      .select('id')

    if (Array.isArray(foreignInsert.data) && foreignInsert.data.length > 0) {
      unauthorizedInsertId = foreignInsert.data[0].id
    }
    const foreignInsertBlockedByRls =
      Boolean(foreignInsert.error) &&
      (
        foreignInsert.error.code === '42501' ||
        /row-level security/i.test(foreignInsert.error.message || '')
      )

    check(
      'Collaborator nao cria demanda para cliente alheio',
      foreignInsertBlockedByRls && !unauthorizedInsertId,
      foreignInsert.error?.message || '',
    )

    const ownInsert = await collaborator
      .from('work_items')
      .insert({
        title: `[V10 SECURITY] Own ${marker}`,
        destino: 'avulsa',
        responsible_id: userId,
        created_by: userId,
      })
      .select('id')
      .single()

    if (ownInsert.error) {
      check('Collaborator cria demanda propria', false, ownInsert.error.message)
    } else {
      ownWorkItemId = ownInsert.data.id
      check('Collaborator cria demanda propria', true)

      const ownRead = await collaborator
        .from('work_items')
        .select('id')
        .eq('id', ownWorkItemId)

      check(
        'Collaborator le demanda propria',
        !ownRead.error && Array.isArray(ownRead.data) && ownRead.data.length === 1,
      )

      const ownUpdate = await collaborator
        .from('work_items')
        .update({ notes: `[V10 SECURITY OWN ${marker}]` })
        .eq('id', ownWorkItemId)
        .select('id')

      check(
        'Collaborator altera demanda propria',
        !ownUpdate.error &&
          Array.isArray(ownUpdate.data) &&
          ownUpdate.data.length === 1,
      )
    }

    const roleEscalation = await collaborator
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', userId)
      .select('id,role')

    const roleBlocked =
      Boolean(roleEscalation.error) ||
      !Array.isArray(roleEscalation.data) ||
      roleEscalation.data.length === 0

    check('Collaborator nao promove propria role', roleBlocked)

    if (!roleBlocked) {
      await admin
        .from('profiles')
        .update({ role: 'collaborator' })
        .eq('id', userId)
    }

    const emailEscalation = await collaborator
      .from('profiles')
      .update({ email: 'ampydigital@gmail.com' })
      .eq('id', userId)
      .select('id,email')

    const emailBlocked =
      Boolean(emailEscalation.error) ||
      !Array.isArray(emailEscalation.data) ||
      emailEscalation.data.length === 0

    check('Collaborator nao troca email de seguranca', emailBlocked)

    if (!emailBlocked) {
      await admin
        .from('profiles')
        .update({ email: originalEmail })
        .eq('id', userId)
    }

    const pautaWrite = await admin
      .from('pautas')
      .update({ id: pauta.id })
      .eq('id', pauta.id)
      .select('id')

    check(
      'Service role grava pautas',
      !pautaWrite.error && pautaWrite.data?.length === 1,
      pautaWrite.error?.message || '',
    )

    const memberWrite = await admin
      .from('pauta_members')
      .update({ id: member.id })
      .eq('id', member.id)
      .select('id')

    check(
      'Service role grava pauta_members',
      !memberWrite.error && memberWrite.data?.length === 1,
      memberWrite.error?.message || '',
    )

    const pautaEvent = await admin
      .from('pauta_events')
      .insert({
        pauta_id: pauta.id,
        board_id: pauta.board_id,
        actor_id: userId,
        action: 'v10_service_role_probe',
        target_type: 'pauta',
        target_id: pauta.id,
      })
      .select('id')
      .single()

    if (!pautaEvent.error) pautaEventId = pautaEvent.data.id

    check(
      'Service role grava pauta_events',
      !pautaEvent.error && Boolean(pautaEventId),
      pautaEvent.error?.message || '',
    )

    const assignmentWrite = await admin
      .from('work_item_board_assignments')
      .update({ id: assignment.id })
      .eq('id', assignment.id)
      .select('id')

    check(
      'Service role grava work_item_board_assignments',
      !assignmentWrite.error && assignmentWrite.data?.length === 1,
      assignmentWrite.error?.message || '',
    )

    const assignmentEvent = await admin
      .from('work_item_board_assignment_events')
      .insert({
        assignment_id: assignment.id,
        work_item_id: assignment.work_item_id,
        pauta_id: pauta.id,
        board_id: assignment.board_id,
        board_column_id: assignment.board_column_id,
        actor_id: userId,
        action: 'v10_service_role_probe',
      })
      .select('id')
      .single()

    if (!assignmentEvent.error) assignmentEventId = assignmentEvent.data.id

    check(
      'Service role grava work_item_board_assignment_events',
      !assignmentEvent.error && Boolean(assignmentEventId),
      assignmentEvent.error?.message || '',
    )

    const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 60 * 60 * 1000)

    const calendarEvent = await admin
      .from('calendar_events')
      .insert({
        title: `[V10 TEST] Service Role ${marker}`,
        type: 'internal',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        created_by: userId,
        source: 'internal',
      })
      .select('id')
      .single()

    if (calendarEvent.error) {
      check(
        'Fixture calendar_event para service role',
        false,
        calendarEvent.error.message,
      )
    } else {
      calendarEventId = calendarEvent.data.id

      const history = await admin
        .from('calendar_event_history')
        .insert({
          event_id: calendarEventId,
          actor_id: userId,
          action: 'v10_service_role_probe',
        })
        .select('id')
        .single()

      if (!history.error) calendarHistoryId = history.data.id

      check(
        'Service role grava calendar_event_history',
        !history.error && Boolean(calendarHistoryId),
        history.error?.message || '',
      )
    }

    console.log('')

    if (failures === 0) {
      console.log('CAMADA 2 - SEGURANCA: PASS')
      console.log('SERVICE ROLE 6/6: PASS')
    } else {
      console.log(`CAMADA 2 - SEGURANCA: FAIL (${failures})`)
      process.exitCode = 2
    }
  } finally {
    try {
      if (calendarHistoryId) {
        await admin
          .from('calendar_event_history')
          .delete()
          .eq('id', calendarHistoryId)
      }

      if (calendarEventId) {
        await admin.from('calendar_events').delete().eq('id', calendarEventId)
      }

      if (assignmentEventId) {
        await admin
          .from('work_item_board_assignment_events')
          .delete()
          .eq('id', assignmentEventId)
      }

      if (pautaEventId) {
        await admin.from('pauta_events').delete().eq('id', pautaEventId)
      }

      if (unauthorizedInsertId) {
        await admin.from('work_items').delete().eq('id', unauthorizedInsertId)
      }

      if (ownWorkItemId) {
        await admin.from('work_items').delete().eq('id', ownWorkItemId)
      }

      if (userId) {
        await admin
          .from('work_items')
          .update({ notes: originalTargetNotes })
          .eq('title', '[V10 TEST] Demanda Sintetica')

        await admin
          .from('profiles')
          .update({
            role: originalRole || 'collaborator',
            email: originalEmail || email,
          })
          .eq('id', userId)

        await collaborator.auth.signOut()

        await admin.from('profiles').delete().eq('id', userId)
        await admin.auth.admin.deleteUser(userId)
      }
    } catch (cleanupError) {
      console.error('ERRO DE CLEANUP:', cleanupError)
      process.exitCode = 3
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
