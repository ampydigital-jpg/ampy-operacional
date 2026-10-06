import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

let fixture
let adminCreated
const user = { id: 'actor', email: 'verified@example.invalid', email_confirmed_at: '2026-01-01' }
const member = { id: 'member', profile_id: user.id, access_type: 'operacional', is_active: true }
globalThis.__eyxoAccessTest = {
  session: () => ({ auth: { getUser: async () => ({ data: { user: fixture.user }, error: null }) } }),
  admin: () => {
    adminCreated++
    return { from(table) {
      const query = {
        select() { return query }, eq() { return query }, is() { return query },
        async maybeSingle() { return { data: fixture[table], error: null } },
      }
      return query
    } }
  },
}
const source = readFileSync(new URL('../lib/server-access.ts', import.meta.url), 'utf8')
  .replace("import 'server-only'", '')
  .replace("import { createClient } from '@/lib/supabase/server'", 'const createClient = globalThis.__eyxoAccessTest.session')
  .replace("import { createAdminClient } from '@/lib/supabase/admin'", 'const createAdminClient = globalThis.__eyxoAccessTest.admin')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { requireActiveActor, requireTotalActor, requireContextAccess, requireMessageResolution } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
function reset() {
  adminCreated = 0
  fixture = { user, profiles: { id: user.id, is_active: true, role: 'admin' }, team_members: member }
}

test('anonymous requests fail before creating the administrative client', async () => {
  reset(); fixture.user = null
  await assert.rejects(requireActiveActor(), /Sessão inválida/)
  assert.equal(adminCreated, 0)
})
test('inactive profile or team blocks access', async () => {
  reset(); fixture.profiles.is_active = false
  await assert.rejects(requireActiveActor(), /Usuário inativo/)
  reset(); fixture.team_members = { ...member, is_active: false }
  await assert.rejects(requireActiveActor(), /equipe inativo/)
})
test('an admin role forged in profiles cannot grant Total Access', async () => {
  reset()
  await assert.rejects(requireTotalActor(), /Acesso Total/)
  fixture.team_members = { ...member, access_type: 'total' }
  assert.equal((await requireTotalActor()).total, true)
})
test('operational actor cannot operate another users context', async () => {
  reset(); fixture.work_items = { id: 'task', responsible_id: 'someone-else', created_by: 'someone-else' }
  const actor = await requireActiveActor()
  await assert.rejects(requireContextAccess(actor, 'work_items', 'task'), /permissão/)
  fixture.work_items.responsible_id = user.id
  await requireContextAccess(actor, 'work_items', 'task')
})
test('message resolution verifies both author and bound demand', async () => {
  reset(); fixture.internal_messages = { id: 'message', created_by_profile_id: user.id, work_item_id: 'task' }
  const actor = await requireActiveActor()
  await assert.rejects(requireMessageResolution(actor, 'message', 'other-task'), /não encontrada/)
  await requireMessageResolution(actor, 'message', 'task')
  fixture.internal_messages.created_by_profile_id = 'someone-else'
  fixture.internal_messages.work_item_id = null
  await assert.rejects(requireMessageResolution(actor, 'message'), /Somente o autor/)
})
