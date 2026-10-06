import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../lib/operation-rules.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { deliverySummary } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))

test('delivery denominator counts each operational demand due in the period once', () => {
  const item = { final_deadline: '2026-10-15', status: 'in_progress' }
  const rows = [
    { ...item, id: 'open', internal_deadline: '2026-09-01' },
    { ...item, id: 'done', status: 'done', completed_at: '2026-09-30T12:00:00Z' },
    { ...item, id: 'parent', is_pauta_card: true },
    { ...item, id: 'cancelled', status: 'cancelled' },
    { ...item, id: 'archived', status: 'archived' },
    { ...item, id: 'other-month', final_deadline: '2026-11-01', completed_at: '2026-10-03T12:00:00Z' },
    { ...item, id: 'no-date', final_deadline: null },
  ]
  const result = deliverySummary(rows, '2026-10-01', '2026-11-01')
  assert.deepEqual(result.planned.map(row => row.id), ['open', 'done'])
  assert.deepEqual(result.done.map(row => row.id), ['done'])
  assert.equal(result.percent, 50)
})

test('empty period stays at zero without division by zero', () => {
  assert.equal(deliverySummary([], '2026-10-01', '2026-11-01').percent, 0)
})
