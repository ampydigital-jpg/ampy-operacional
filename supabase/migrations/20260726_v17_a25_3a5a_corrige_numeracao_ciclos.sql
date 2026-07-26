#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const {
  spawnSync,
} = require('child_process')

const ROOT = process.cwd()

const EXPECTED_HEAD =
  'a7f38e27a6586a71f867a2a154e6995d910bc60f'

const MIGRATION =
  'supabase/migrations/20260726_v17_a25_3a5a_corrige_numeracao_ciclos.sql'

const ROLLBACK =
  'supabase/rollback/20260726_v17_a25_3a5a_corrige_numeracao_ciclos_rollback.sql'

const UI_FILES = [
  'app/dashboard/quadro/page.tsx',
  'app/dashboard/quadro/BoardWorkspace.tsx',
  'app/globals.css',
]

const originals =
  new Map()

let migrationCommit = ''
let uiCommit = ''
let uiCommitted = false

function absolute(file) {
  return path.join(
    ROOT,
    file,
  )
}

function exists(file) {
  return fs.existsSync(
    absolute(file),
  )
}

function read(file) {
  return fs
    .readFileSync(
      absolute(file),
      'utf8',
    )
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function preserve(file) {
  if (
    originals.has(file)
  ) {
    return
  }

  originals.set(
    file,
    fs.readFileSync(
      absolute(file),
    ),
  )
}

function write(
  file,
  content,
) {
  preserve(file)

  fs.writeFileSync(
    absolute(file),
    content.replace(
      /\r\n/g,
      '\n',
    ),
    'utf8',
  )
}

function run(
  command,
  args,
  {
    capture = false,
    inherit = false,
  } = {},
) {
  const result =
    spawnSync(
      command,
      args,
      {
        cwd: ROOT,
        encoding: 'utf8',
        windowsHide: true,
        shell: false,

        stdio:
          inherit
            ? 'inherit'
            : capture
              ? [
                  'ignore',
                  'pipe',
                  'pipe',
                ]
              : 'inherit',

        env: {
          ...process.env,
          GIT_PAGER:
            'cat',
          PAGER:
            'cat',
        },
      },
    )

  if (result.error) {
    throw result.error
  }

  if (
    result.status !== 0
  ) {
    const output = [
      result.stdout || '',
      result.stderr || '',
    ]
      .join('\n')
      .trim()

    throw new Error(
      command +
        ' ' +
        args.join(' ') +
        ' falhou.' +
        (
          output
            ? '\n' +
              output
            : ''
        ),
    )
  }

  return capture
    ? String(
        result.stdout || '',
      ).trim()
    : ''
}

function replaceLiteralOnce(
  source,
  oldText,
  newText,
  label,
) {
  const count =
    source
      .split(oldText)
      .length - 1

  if (count !== 1) {
    throw new Error(
      label +
        ': esperada 1 ocorrência, encontradas ' +
        String(count) +
        '.',
    )
  }

  return source.replace(
    oldText,
    newText,
  )
}

function replaceRegexOnce(
  source,
  pattern,
  replacement,
  label,
) {
  const flags =
    pattern.flags.includes(
      'g',
    )
      ? pattern.flags
      : pattern.flags +
        'g'

  const globalPattern =
    new RegExp(
      pattern.source,
      flags,
    )

  const matches =
    Array.from(
      source.matchAll(
        globalPattern,
      ),
    )

  if (
    matches.length !== 1
  ) {
    throw new Error(
      label +
        ': esperada 1 ocorrência, encontradas ' +
        String(
          matches.length,
        ) +
        '.',
    )
  }

  return source.replace(
    pattern,
    replacement,
  )
}

function validateRepository() {
  if (!exists('.git')) {
    throw new Error(
      'Execute dentro da PASTA BASE.',
    )
  }

  for (
    const file
    of [
      MIGRATION,
      ROLLBACK,
      ...UI_FILES,
    ]
  ) {
    if (!exists(file)) {
      throw new Error(
        'Arquivo obrigatório ausente: ' +
          file,
      )
    }
  }

  const branch =
    run(
      'git',
      [
        'branch',
        '--show-current',
      ],
      {
        capture: true,
      },
    )

  if (
    branch !== 'main'
  ) {
    throw new Error(
      'Branch incorreta: ' +
        branch,
    )
  }

  run(
    'git',
    [
      'fetch',
      'origin',
      'main',
    ],
  )

  const head =
    run(
      'git',
      [
        'rev-parse',
        'HEAD',
      ],
      {
        capture: true,
      },
    )

  const origin =
    run(
      'git',
      [
        'rev-parse',
        'origin/main',
      ],
      {
        capture: true,
      },
    )

  if (
    head !==
    EXPECTED_HEAD
  ) {
    throw new Error(
      'Commit-base inesperado.\n' +
        'Esperado: ' +
        EXPECTED_HEAD +
        '\nEncontrado: ' +
        head,
    )
  }

  if (head !== origin) {
    throw new Error(
      'HEAD e origin/main estão divergentes.',
    )
  }

  const staged =
    run(
      'git',
      [
        'diff',
        '--cached',
        '--name-only',
      ],
      {
        capture: true,
      },
    )

  if (staged) {
    throw new Error(
      'O stage não está vazio:\n' +
        staged,
    )
  }

  const tracked =
    run(
      'git',
      [
        'status',
        '--porcelain',
        '--untracked-files=no',
      ],
      {
        capture: true,
      },
    )

  if (tracked) {
    throw new Error(
      'Existem alterações rastreadas:\n' +
        tracked,
    )
  }

  const migrationText =
    read(MIGRATION)

  if (
    !migrationText.includes(
      'V17-A25.3A5A aplicada com sucesso',
    ) ||
    !migrationText.includes(
      'v_source.cycle_number + 1',
    )
  ) {
    throw new Error(
      'A migration local não corresponde à correção aplicada.',
    )
  }
}

function checkStage(
  expectedFiles,
) {
  const staged =
    run(
      'git',
      [
        'diff',
        '--cached',
        '--name-only',
      ],
      {
        capture: true,
      },
    )
      .split(/\r?\n/)
      .map(
        (item) =>
          item.trim(),
      )
      .filter(Boolean)

  const missing =
    expectedFiles.filter(
      (file) =>
        !staged.includes(
          file,
        ),
    )

  const unexpected =
    staged.filter(
      (file) =>
        !expectedFiles.includes(
          file,
        ),
    )

  if (
    staged.length !==
      expectedFiles.length ||
    missing.length > 0 ||
    unexpected.length > 0
  ) {
    throw new Error(
      'Stage inválido.\n' +
        'Encontrados: ' +
        staged.join(', ') +
        '\nAusentes: ' +
        missing.join(', ') +
        '\nInesperados: ' +
        unexpected.join(', '),
    )
  }
}

function versionMigration() {
  console.log('')
  console.log(
    'VERSIONANDO A MIGRATION APLICADA',
  )
  console.log(
    '------------------------------------------------------------',
  )

  const files = [
    MIGRATION,
    ROLLBACK,
  ]

  run(
    'git',
    [
      'add',
      '--',
      ...files,
    ],
  )

  checkStage(files)

  run(
    'git',
    [
      'diff',
      '--cached',
      '--check',
    ],
  )

  run(
    'git',
    [
      '--no-pager',
      'diff',
      '--cached',
      '--stat',
    ],
  )

  run(
    'git',
    [
      'commit',
      '-m',
      'fix: corrige numeracao dos ciclos',
    ],
  )

  migrationCommit =
    run(
      'git',
      [
        'rev-parse',
        'HEAD',
      ],
      {
        capture: true,
      },
    )

  run(
    'git',
    [
      'push',
      'origin',
      'main',
    ],
  )

  run(
    'git',
    [
      'fetch',
      'origin',
      'main',
    ],
  )

  const remote =
    run(
      'git',
      [
        'rev-parse',
        'origin/main',
      ],
      {
        capture: true,
      },
    )

  if (
    migrationCommit !==
    remote
  ) {
    throw new Error(
      'A migration não ficou alinhada com origin/main.',
    )
  }

  console.log(
    'Migration versionada: ' +
      migrationCommit,
  )
}

function patchBoardPage() {
  let source =
    read(
      UI_FILES[0],
    )

  source =
    replaceLiteralOnce(
      source,

      `'id,title,description,type,status,priority,destino,board_id,board_column_id,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,created_at,updated_at,card_tag,card_tag_color',`,

      `'id,title,description,type,status,priority,destino,board_id,board_column_id,client_id,client_service_id,responsible_id,internal_deadline,final_deadline,drive_link,notes,blocked_reason,created_at,updated_at,card_tag,card_tag_color,cycle_number,generated_from_cycle_id,generated_at,cycle_duration_days_snapshot',`,

      'QuadroPage: campos de ciclo',
    )

  source =
    replaceLiteralOnce(
      source,

      `  const demands = demandRows.map(
    (item: any) => ({`,

      `  const demandRowsById =
    mapById(demandRows)

  const nextCycleBySourceId =
    new Map<string, any>()

  for (
    const demand
    of demandRows
  ) {
    if (
      demand.generated_from_cycle_id
    ) {
      nextCycleBySourceId.set(
        demand.generated_from_cycle_id,
        demand,
      )
    }
  }

  const demands = demandRows.map(
    (item: any) => ({`,

      'QuadroPage: mapas da cadeia',
    )

  source =
    replaceLiteralOnce(
      source,

      `      schedule_requirements:
        requirementsByItem.get(item.id) || [],
    }),`,

      `      schedule_requirements:
        requirementsByItem.get(item.id) || [],

      previous_cycle:
        item.generated_from_cycle_id
          ? demandRowsById.get(
              item.generated_from_cycle_id,
            ) || null
          : null,

      next_cycle:
        nextCycleBySourceId.get(
          item.id,
        ) || null,
    }),`,

      'QuadroPage: vínculos anterior e próximo',
    )

  write(
    UI_FILES[0],
    source,
  )
}

function patchBoardWorkspace() {
  let source =
    read(
      UI_FILES[1],
    )

  source =
    replaceLiteralOnce(
      source,

      `function formatPeriodTitle(
  clientName: string,`,

      `function formatAgendaTagDate(
  value?: string | null,
) {
  if (!value) {
    return 'Agendada'
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Agendada'
  }

  const parts =
    new Intl.DateTimeFormat(
      'pt-BR',
      {
        timeZone:
          'America/Sao_Paulo',
        day:
          '2-digit',
        month:
          '2-digit',
        hour:
          '2-digit',
        minute:
          '2-digit',
        hour12:
          false,
      },
    ).formatToParts(date)

  const readPart =
    (
      type:
        | 'day'
        | 'month'
        | 'hour'
        | 'minute',
    ) =>
      parts.find(
        (part) =>
          part.type === type,
      )?.value || ''

  const day =
    readPart('day')

  const month =
    readPart('month')

  const hour =
    readPart('hour')

  const minute =
    readPart('minute')

  if (
    !day ||
    !month ||
    !hour
  ) {
    return 'Agendada'
  }

  return (
    day +
    '/' +
    month +
    ' · ' +
    hour +
    'h' +
    (
      minute &&
      minute !== '00'
        ? minute
        : ''
    )
  )
}

function agendaTagText(
  requirement: any,
) {
  const status =
    String(
      requirement?.status ||
      'pending',
    )

  if (
    status === 'completed'
  ) {
    return 'Realizada'
  }

  if (
    status === 'confirmed' ||
    status === 'scheduled'
  ) {
    return formatAgendaTagDate(
      requirement
        ?.calendar_event
        ?.starts_at ||
      requirement
        ?.scheduled_at ||
      null,
    )
  }

  if (
    status === 'cancelled'
  ) {
    return 'Cancelada'
  }

  return 'Pendente'
}

function formatCyclePeriod(
  start?: string | null,
  end?: string | null,
) {
  if (!start && !end) {
    return 'Período não definido'
  }

  if (start && end) {
    return (
      formatDateShort(start) +
      ' – ' +
      formatDateShort(end)
    )
  }

  return formatDateShort(
    start || end,
  )
}

function formatPeriodTitle(
  clientName: string,`,

      'BoardWorkspace: formatadores de agenda e ciclo',
    )

  source =
    replaceRegexOnce(
      source,

      /<span>\s*\{alignmentRequirement\.status ===[\s\S]*?<\/span>/,

      `<span>
                                      {agendaTagText(
                                        alignmentRequirement,
                                      )}
                                    </span>`,

      'BoardWorkspace: texto REU',
    )

  source =
    replaceRegexOnce(
      source,

      /<span>\s*\{captureRequirement\.status ===[\s\S]*?<\/span>/,

      `<span>
                                      {agendaTagText(
                                        captureRequirement,
                                      )}
                                    </span>`,

      'BoardWorkspace: texto CAP',
    )

  source =
    replaceLiteralOnce(
      source,

      `                            </div>

                            <h3>
                              {item.title}
                            </h3>`,

      `                            </div>

                            {item.cycle_number && (
                              <div className="board-cycle-identity">
                                <span className="board-cycle-number">
                                  <i className="ti ti-refresh" />

                                  CICLO{' '}
                                  {item.cycle_number}
                                </span>

                                <span className="board-cycle-period">
                                  <i className="ti ti-calendar-stats" />

                                  {formatCyclePeriod(
                                    item.internal_deadline,
                                    item.final_deadline,
                                  )}
                                </span>

                                {item.next_cycle?.id && (
                                  <span className="board-cycle-next-ready">
                                    <i className="ti ti-circle-check" />

                                    Próximo gerado
                                  </span>
                                )}
                              </div>
                            )}

                            <h3>
                              {item.title}
                            </h3>

                            {item.cycle_number && (
                              <div
                                className="board-cycle-chain"
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                                onMouseDown={(event) =>
                                  event.stopPropagation()
                                }
                              >
                                {item.previous_cycle?.id && (
                                  <a
                                    href={
                                      '/dashboard/quadro?board=' +
                                      activeBoardId +
                                      '&item=' +
                                      item.previous_cycle.id
                                    }
                                  >
                                    <i className="ti ti-arrow-back-up" />

                                    Gerado do ciclo anterior
                                  </a>
                                )}

                                {item.next_cycle?.id && (
                                  <a
                                    href={
                                      '/dashboard/quadro?board=' +
                                      activeBoardId +
                                      '&item=' +
                                      item.next_cycle.id
                                    }
                                  >
                                    Próximo ciclo já gerado

                                    <i className="ti ti-arrow-forward-up" />
                                  </a>
                                )}

                                {!item.previous_cycle?.id &&
                                  !item.next_cycle?.id && (
                                    <span>
                                      <i className="ti ti-point-filled" />

                                      Primeiro ciclo da sequência
                                    </span>
                                  )}
                              </div>
                            )}`,

      'BoardWorkspace: identidade do ciclo',
    )

  write(
    UI_FILES[1],
    source,
  )
}

function patchCss() {
  let source =
    read(
      UI_FILES[2],
    )

  const marker =
    '/* AMPY-V17-A25.3A5B — IDENTIDADE VISUAL DOS CICLOS */'

  if (
    source.includes(
      marker,
    )
  ) {
    throw new Error(
      'O CSS da V17-A25.3A5B já existe.',
    )
  }

  source += `

${marker}

.board-cycle-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: 2px 0 8px;
}

.board-cycle-number,
.board-cycle-period,
.board-cycle-next-ready {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  padding: 4px 7px;
  border: 1px solid #DCE5EF;
  border-radius: 8px;
  background: #F8FAFC;
  color: #475569;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.board-cycle-number {
  border-color:
    rgba(37, 99, 235, 0.22);
  background:
    linear-gradient(
      135deg,
      rgba(239, 246, 255, 0.96),
      rgba(255, 255, 255, 0.98)
    );
  color: #1D4ED8;
}

.board-cycle-period {
  color: #64748B;
}

.board-cycle-next-ready {
  border-color:
    rgba(22, 163, 74, 0.24);
  background:
    linear-gradient(
      135deg,
      rgba(240, 253, 244, 0.96),
      rgba(255, 255, 255, 0.98)
    );
  color: #15803D;
}

.board-cycle-identity i {
  flex: 0 0 auto;
  font-size: 12px;
}

.board-cycle-chain {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin: -2px 0 8px;
}

.board-cycle-chain a,
.board-cycle-chain span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: #64748B;
  font-size: 9px;
  font-weight: 800;
  line-height: 1.25;
  text-decoration: none;
}

.board-cycle-chain a {
  padding: 4px 6px;
  border-radius: 7px;
  background:
    rgba(241, 245, 249, 0.82);
  transition:
    color 140ms ease,
    background 140ms ease;
}

.board-cycle-chain a:hover {
  background: #E2E8F0;
  color: #1D4ED8;
}

.board-cycle-chain i {
  flex: 0 0 auto;
  font-size: 11px;
}

.board-cycle-agenda-tag[data-status="confirmed"] {
  border-color:
    rgba(22, 163, 74, 0.34);
  background:
    linear-gradient(
      135deg,
      rgba(220, 252, 231, 0.98),
      rgba(240, 253, 244, 0.98)
    );
  color: #15803D;
  box-shadow:
    0 7px 16px
    rgba(22, 163, 74, 0.08);
}

.board-cycle-agenda-tag[data-status="confirmed"] strong,
.board-cycle-agenda-tag[data-status="confirmed"] span {
  color: #15803D;
}
`

  write(
    UI_FILES[2],
    source,
  )
}

function validateUi() {
  const validations = [
    [
      UI_FILES[0],
      'cycle_number,generated_from_cycle_id',
    ],
    [
      UI_FILES[0],
      'previous_cycle:',
    ],
    [
      UI_FILES[0],
      'next_cycle:',
    ],
    [
      UI_FILES[1],
      'function agendaTagText',
    ],
    [
      UI_FILES[1],
      'formatAgendaTagDate',
    ],
    [
      UI_FILES[1],
      'board-cycle-identity',
    ],
    [
      UI_FILES[1],
      'Gerado do ciclo anterior',
    ],
    [
      UI_FILES[1],
      'Próximo ciclo já gerado',
    ],
    [
      UI_FILES[2],
      'AMPY-V17-A25.3A5B',
    ],
  ]

  for (
    const [
      file,
      anchor,
    ]
    of validations
  ) {
    if (
      !read(file).includes(
        anchor,
      )
    ) {
      throw new Error(
        'Validação ausente em ' +
          file +
          ': ' +
          anchor,
      )
    }
  }
}

function validateBuild() {
  console.log('')
  console.log(
    'VALIDANDO TYPESCRIPT E BUILD',
  )
  console.log(
    '------------------------------------------------------------',
  )

  run(
    'node',
    [
      '-e',
      "require.resolve('next/package.json'); require.resolve('typescript/package.json')",
    ],
    {
      inherit: true,
    },
  )

  run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '& npm.cmd exec tsc -- --noEmit --incremental false',
    ],
    {
      inherit: true,
    },
  )

  fs.rmSync(
    absolute('.next'),
    {
      recursive: true,
      force: true,
    },
  )

  run(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      '& npm.cmd run build',
    ],
    {
      inherit: true,
    },
  )

  run(
    'git',
    [
      'diff',
      '--check',
      '--',
      ...UI_FILES,
    ],
  )
}

function commitUi() {
  console.log('')
  console.log(
    'VERSIONANDO A INTERFACE',
  )
  console.log(
    '------------------------------------------------------------',
  )

  run(
    'git',
    [
      'add',
      '--',
      ...UI_FILES,
    ],
  )

  checkStage(
    UI_FILES,
  )

  run(
    'git',
    [
      'diff',
      '--cached',
      '--check',
    ],
  )

  run(
    'git',
    [
      '--no-pager',
      'diff',
      '--cached',
      '--stat',
    ],
  )

  run(
    'git',
    [
      'commit',
      '-m',
      'feat: adiciona identidade visual aos ciclos',
    ],
  )

  uiCommitted = true

  uiCommit =
    run(
      'git',
      [
        'rev-parse',
        'HEAD',
      ],
      {
        capture: true,
      },
    )

  run(
    'git',
    [
      'push',
      'origin',
      'main',
    ],
  )

  run(
    'git',
    [
      'fetch',
      'origin',
      'main',
    ],
  )

  const remote =
    run(
      'git',
      [
        'rev-parse',
        'origin/main',
      ],
      {
        capture: true,
      },
    )

  if (
    uiCommit !== remote
  ) {
    throw new Error(
      'A interface não ficou alinhada com origin/main.',
    )
  }
}

function restoreUi() {
  if (uiCommitted) {
    return
  }

  spawnSync(
    'git',
    [
      'restore',
      '--staged',
      '--',
      ...UI_FILES,
    ],
    {
      cwd: ROOT,
      stdio: 'ignore',
      shell: false,
    },
  )

  for (
    const [
      file,
      buffer,
    ]
    of originals
  ) {
    fs.writeFileSync(
      absolute(file),
      buffer,
    )
  }
}

function finalValidation() {
  const head =
    run(
      'git',
      [
        'rev-parse',
        'HEAD',
      ],
      {
        capture: true,
      },
    )

  const origin =
    run(
      'git',
      [
        'rev-parse',
        'origin/main',
      ],
      {
        capture: true,
      },
    )

  if (head !== origin) {
    throw new Error(
      'HEAD e origin/main divergentes ao final.',
    )
  }

  const tracked =
    run(
      'git',
      [
        'status',
        '--porcelain',
        '--untracked-files=no',
      ],
      {
        capture: true,
      },
    )

  if (tracked) {
    throw new Error(
      'Restaram alterações rastreadas:\n' +
        tracked,
    )
  }
}

function main() {
  console.log('')
  console.log(
    '============================================================',
  )
  console.log(
    'V17-A25.3A5B — IDENTIDADE VISUAL DOS CICLOS',
  )
  console.log(
    '============================================================',
  )

  validateRepository()
  versionMigration()

  patchBoardPage()
  patchBoardWorkspace()
  patchCss()

  validateUi()
  validateBuild()
  commitUi()
  finalValidation()

  console.log('')
  console.log(
    '============================================================',
  )
  console.log(
    'V17-A25.3A5B CONCLUÍDA',
  )
  console.log(
    '============================================================',
  )

  console.log(
    'Commit da numeração: ' +
      migrationCommit,
  )

  console.log(
    'Commit visual: ' +
      uiCommit,
  )

  console.log(
    'HEAD e origin/main: alinhados',
  )

  console.log(
    'TypeScript: aprovado',
  )

  console.log(
    'Build limpo: aprovado',
  )

  console.log(
    'CAP/REU confirmadas: data e horário inicial',
  )

  console.log(
    'Identidade CICLO: implementada',
  )

  console.log(
    'Navegação anterior/próximo: implementada',
  )

  console.log('')
  console.log(
    'Últimos commits:',
  )

  run(
    'git',
    [
      '--no-pager',
      'log',
      '-5',
      '--oneline',
    ],
  )
}

try {
  main()
} catch (error) {
  console.error('')
  console.error(
    '[ERRO]',
    error?.message || error,
  )

  restoreUi()

  if (
    migrationCommit &&
    !uiCommitted
  ) {
    console.error('')
    console.error(
      'A migration permaneceu versionada no commit: ' +
        migrationCommit,
    )

    console.error(
      'As alterações visuais foram restauradas.',
    )
  }

  if (uiCommitted) {
    console.error('')
    console.error(
      'O commit visual foi preservado: ' +
        uiCommit,
    )
  }

  process.exitCode = 1
}