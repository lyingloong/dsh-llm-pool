/**
 * dsh-llm-pool — browser half.
 *
 * Hand-written closure-factory bundle for the DSH Web client. It follows the
 * same contract as dsh-model-tester: the module registers a factory with the
 * platform module loader, resolves `react` through the injected require, and
 * registers a panel into the Models settings page footer.
 */

window.__ModuleLoader__.load({ id: 'dsh-llm-pool', factory: (require) => {
var module = { exports: {} }; var exports = module.exports
const React = require('react')
const el = React.createElement

const CSS = [
  '.lp-panel{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1);padding:14px 16px;margin:10px 0 4px;font-size:13px;color:var(--dsw-alias-label-primary);}',
  '.lp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;}',
  '.lp-title{font-weight:600;font-size:14px;}',
  '.lp-sub{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:3px;line-height:1.6;}',
  '.lp-actions{display:flex;gap:8px;flex-wrap:wrap;}',
  '.lp-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:8px;padding:5px 12px;font-size:12px;cursor:pointer;white-space:nowrap;}',
  '.lp-btn:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary);}',
  '.lp-btn:disabled{opacity:.45;cursor:default;}',
  '.lp-btn-primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base);}',
  '.lp-btn-primary:hover{color:var(--dsw-alias-bg-base);opacity:.9;}',
  '.lp-btn-danger{color:var(--dsw-alias-state-error-primary);}',
  '.lp-banner{margin-top:10px;padding:8px 10px;border-radius:8px;font-size:12px;line-height:1.6;}',
  '.lp-banner-info{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);}',
  '.lp-banner-error{border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);}',
  '.lp-banner-warn{border:1px solid var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);}',
  '.lp-empty{color:var(--dsw-alias-label-secondary);margin-top:12px;line-height:1.7;}',
  '.lp-pool{border-top:1px solid var(--dsw-alias-border-l1);margin-top:14px;padding-top:12px;}',
  '.lp-pool:first-of-type{border-top:0;padding-top:0;}',
  '.lp-pool-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
  '.lp-pool-name{font-weight:600;}',
  '.lp-badge{font-size:11px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;color:var(--dsw-alias-label-secondary);white-space:nowrap;}',
  '.lp-badge-ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary);}',
  '.lp-badge-warn{color:var(--dsw-alias-state-warn-primary);border-color:var(--dsw-alias-state-warn-primary);}',
  '.lp-badge-error{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);}',
  '.lp-pool-stats{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:6px;line-height:1.7;}',
  '.lp-model{display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap;padding:6px 0;border-top:1px dashed var(--dsw-alias-border-l1);}',
  '.lp-model:first-child{border-top:0;}',
  '.lp-model-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;}',
  '.lp-model-name{color:var(--dsw-alias-label-secondary);font-size:12px;}',
  '.lp-target{font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:1px 6px;white-space:nowrap;}',
  '.lp-model-actions{margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap;}',
  '.lp-result{font-size:11px;border-radius:999px;padding:1px 8px;border:1px solid var(--dsw-alias-border-l2);white-space:nowrap;}',
  '.lp-result-ok{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary);}',
  '.lp-result-fail{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary);}',
  '.lp-result-running{color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);}',
  '.lp-detail{font-size:11px;color:var(--dsw-alias-label-secondary);flex-basis:100%;line-height:1.6;word-break:break-word;}',
  '.lp-fold{margin-top:8px;font-size:12px;}',
  '.lp-fold summary{cursor:pointer;color:var(--dsw-alias-label-secondary);}',
  '.lp-table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11px;}',
  '.lp-table th,.lp-table td{text-align:left;padding:3px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:top;}',
  '.lp-table th{color:var(--dsw-alias-label-secondary);font-weight:500;}',
  '.lp-form{display:flex;flex-direction:column;gap:12px;}',
  '.lp-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;}',
  '.lp-field{display:flex;flex-direction:column;gap:4px;font-size:12px;}',
  '.lp-field>span{color:var(--dsw-alias-label-secondary);}',
  '.lp-field input,.lp-field select,.lp-field textarea{font-size:12px;padding:5px 8px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-family:inherit;}',
  '.lp-field textarea{min-height:160px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;line-height:1.5;}',
  '.lp-field small{color:var(--dsw-alias-label-secondary);line-height:1.5;}',
  '.lp-section{border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:10px 12px;}',
  '.lp-section-title{font-weight:600;font-size:12px;margin-bottom:8px;}',
  '.lp-members{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;}',
  '.lp-member-list{display:flex;flex-direction:column;gap:4px;max-height:220px;overflow:auto;}',
  '.lp-member{display:flex;align-items:center;gap:6px;font-size:12px;padding:2px 0;}',
  '.lp-member-id{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary);}',
  '.lp-member-actions{margin-left:auto;display:flex;gap:4px;}',
  '.lp-mini{border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:1px 6px;font-size:11px;cursor:pointer;}',
  '.lp-mini:disabled{opacity:.35;cursor:default;}',
  '.lp-model-editor{border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:8px 10px;margin-top:8px;}',
  '.lp-model-editor-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
  '.lp-targets{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:8px;}',
  '.lp-target-field{display:flex;flex-direction:column;gap:3px;font-size:11px;}',
  '.lp-target-field>span{color:var(--dsw-alias-label-secondary);}',
  '.lp-target-field select,.lp-target-field input{font-size:12px;padding:4px 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}',
  '.lp-footer{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;}',
  '.lp-error-list{margin:6px 0 0;padding-left:18px;line-height:1.7;}',
  '.lp-editor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;}',
  '.lp-editor-title{font-weight:600;font-size:13px;}',
  '.lp-hint{font-size:11px;color:var(--dsw-alias-label-secondary);line-height:1.6;}',
  '.lp-chip-row{display:flex;gap:4px;flex-wrap:wrap;}',
  '.lp-nowrap{white-space:nowrap;}',
].join('\n')

const STRATEGY_LABELS = {
  sticky: '会话粘性',
  'round-robin': '每次轮询',
  failover: '主备切换',
}

const STATUS_LABELS = {
  pending: '待测',
  running: '测试中',
  ok: '可用',
  fail: '失败',
}

const errorText = (error) => {
  if (error !== null && typeof error === 'object' && typeof error.message === 'string') return error.message
  return String(error)
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key])
    return out
  }
  return value
}

const sameJson = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const keyOf = (...parts) => parts.join('\u0000')

const shortSession = (sessionId) => {
  if (typeof sessionId !== 'string' || sessionId.length === 0) return '匿名'
  if (sessionId.startsWith('llm-pool-test:')) return '测试'
  return sessionId.length > 14 ? sessionId.slice(0, 14) + '…' : sessionId
}

const formatTime = (ms) => {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '—'
  try {
    return new Date(ms).toLocaleTimeString('zh-CN', { hour12: false })
  } catch (error) {
    return '—'
  }
}

const formatCooldown = (until) => {
  if (typeof until !== 'number') return null
  const seconds = Math.max(0, Math.round((until - Date.now()) / 1000))
  if (seconds <= 0) return null
  if (seconds >= 60) return Math.round(seconds / 60) + ' 分钟'
  return seconds + ' 秒'
}

const validRouteId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

const callRoute = async (path, init) => {
  let response
  try {
    response = await fetch(path, init)
  } catch (error) {
    throw new Error('网络请求失败：' + errorText(error))
  }
  const text = await response.text()
  let value = null
  try {
    value = JSON.parse(text)
  } catch (error) {
    // non-JSON body
  }
  if (!response.ok) {
    const message = value !== null && typeof value === 'object' && typeof value.message === 'string'
      ? value.message
      : text.slice(0, 240)
    const error = new Error('HTTP ' + response.status + '：' + message)
    if (value !== null && typeof value === 'object' && Array.isArray(value.diagnostics)) error.diagnostics = value.diagnostics
    throw error
  }
  if (value === null || typeof value !== 'object') throw new Error('响应不是 JSON 对象')
  return value
}

const loadStatus = () => callRoute('/llm-pool/status')
const postJson = (path, body) => callRoute(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

const emptyDraft = (data) => ({
  originalId: null,
  id: '',
  displayName: '',
  strategy: 'sticky',
  members: [],
  models: [],
  rawPool: {},
  available: new Map((data?.availableProviders ?? []).map((provider) => [provider.id, provider])),
})

const draftFromRawPool = (data, poolId, rawPool) => ({
  originalId: poolId,
  id: poolId,
  displayName: typeof rawPool.displayName === 'string' ? rawPool.displayName : poolId,
  strategy: STRATEGY_LABELS[rawPool.strategy] === undefined ? 'sticky' : rawPool.strategy,
  members: Array.isArray(rawPool.members) ? [...rawPool.members] : [],
  models: Array.isArray(rawPool.models)
    ? rawPool.models.map((model) => {
        const targets = {}
        const rawTargets = model.targets !== null && typeof model.targets === 'object' ? model.targets : {}
        for (const [member, value] of Object.entries(rawTargets)) {
          if (typeof value === 'string') targets[member] = value
          else if (value !== null && typeof value === 'object' && typeof value.model === 'string') targets[member] = value.model
        }
        return {
          id: typeof model.id === 'string' ? model.id : '',
          name: typeof model.name === 'string' ? model.name : '',
          targets,
          contextWindow: typeof model.contextWindow === 'number' ? model.contextWindow : '',
          maxTokens: typeof model.maxTokens === 'number' ? model.maxTokens : '',
          raw: clone(model),
        }
      })
    : [],
  rawPool: clone(rawPool),
  available: new Map((data?.availableProviders ?? []).map((provider) => [provider.id, provider])),
})

const providerOf = (draft, member) => draft.available.get(member)

const modelsOf = (draft, member) => {
  const provider = providerOf(draft, member)
  return provider !== undefined && Array.isArray(provider.models) ? provider.models : []
}

function validateDraft(draft, data) {
  const errors = []
  const id = draft.id.trim()
  if (id.length === 0) errors.push('统一服务商 ID 不能为空')
  else if (!validRouteId.test(id)) errors.push('统一服务商 ID 必须以字母或数字开头，只能包含字母、数字、点、下划线、短横线')
  if (data !== null && data.config !== null && data.config.providers !== null && typeof data.config.providers === 'object') {
    if (draft.originalId !== id && Object.prototype.hasOwnProperty.call(data.config.providers, id)) errors.push(`统一服务商 ID "${id}" 已存在`)
  }
  if (Array.isArray(data?.availableProviders) && data.availableProviders.some((provider) => provider.id === id)) {
    errors.push(`统一服务商 ID "${id}" 与真实渠道重名`)
  }
  if (draft.members.length === 0) errors.push('至少要选择一个成员渠道')
  const seenModels = new Set()
  for (const model of draft.models) {
    const modelId = model.id.trim()
    if (modelId.length === 0) errors.push('存在模型 ID 为空的条目')
    else if (seenModels.has(modelId)) errors.push(`模型 ID "${modelId}" 重复`)
    seenModels.add(modelId)
    const mapped = draft.members.filter((member) => typeof model.targets[member] === 'string' && model.targets[member].trim().length > 0)
    if (mapped.length === 0) errors.push(`模型 "${modelId || '（空）'}" 至少要映射到一个成员渠道`)
    for (const [label, value] of [['contextWindow', model.contextWindow], ['maxTokens', model.maxTokens]]) {
      if (value === '' || value === undefined || value === null) continue
      const numeric = Number(value)
      if (!Number.isSafeInteger(numeric) || numeric <= 0) errors.push(`模型 "${modelId || '（空）'}" 的 ${label} 必须是正整数`)
    }
  }
  return errors
}

function buildPoolFromDraft(draft) {
  const base = draft.rawPool !== null && typeof draft.rawPool === 'object' ? clone(draft.rawPool) : {}
  const models = draft.models.map((model) => {
    const rawModel = model.raw !== null && typeof model.raw === 'object' ? clone(model.raw) : {}
    const targets = {}
    for (const member of draft.members) {
      const value = model.targets[member]
      if (typeof value === 'string' && value.trim().length > 0) targets[member] = value.trim()
    }
    const next = {
      ...rawModel,
      id: model.id.trim(),
      targets,
    }
    if (model.name.trim().length > 0) next.name = model.name.trim()
    else delete next.name
    if (model.contextWindow !== '' && model.contextWindow !== undefined && model.contextWindow !== null) next.contextWindow = Number(model.contextWindow)
    else delete next.contextWindow
    if (model.maxTokens !== '' && model.maxTokens !== undefined && model.maxTokens !== null) next.maxTokens = Number(model.maxTokens)
    else delete next.maxTokens
    return next
  })
  return {
    ...base,
    displayName: draft.displayName.trim().length > 0 ? draft.displayName.trim() : draft.id.trim(),
    strategy: draft.strategy,
    members: [...draft.members],
    models,
  }
}

function mergeProviders(data, poolId, poolValue, deletePool) {
  const providers = data !== null && data.config !== null && data.config.providers !== null && typeof data.config.providers === 'object'
    ? clone(data.config.providers)
    : {}
  if (deletePool === true) delete providers[poolId]
  else providers[poolId] = poolValue
  return providers
}

function buildAdvancedConfig(data) {
  const providers = data !== null && data.config !== null && data.config.providers !== null && typeof data.config.providers === 'object'
    ? clone(data.config.providers)
    : {}
  const retryPolicy = data !== null && data.config !== null && data.config.retryPolicy !== undefined
    ? clone(data.config.retryPolicy)
    : undefined
  return {
    ...(retryPolicy === undefined ? {} : { retryPolicy }),
    providers,
  }
}

function PoolResultBadge({ result }) {
  if (result === undefined) return null
  const status = result.status === 'running' ? 'running' : result.ok === true ? 'ok' : 'fail'
  const label = STATUS_LABELS[status] ?? status
  const className = status === 'ok' ? 'lp-result lp-result-ok' : status === 'fail' ? 'lp-result lp-result-fail' : 'lp-result lp-result-running'
  const parts = [el('span', { className, key: 'badge' }, label)]
  if (result.status === 'ok' || result.status === 'fail') {
    const value = result.result ?? {}
    const member = typeof value.member === 'string' && value.member.length > 0 ? value.member : null
    const target = typeof value.targetModel === 'string' && value.targetModel.length > 0 ? value.targetModel : null
    if (member !== null) {
      parts.push(el('span', { className: 'lp-detail', key: 'route' }, '渠道 ' + member + (target === null ? '' : ' → ' + target)))
    }
    if (typeof value.elapsedMs === 'number') parts.push(el('span', { className: 'lp-detail', key: 'elapsed' }, '耗时 ' + (value.elapsedMs / 1000).toFixed(2) + ' s'))
    if (typeof value.ttftMs === 'number') parts.push(el('span', { className: 'lp-detail', key: 'ttft' }, '首 token ' + (value.ttftMs / 1000).toFixed(2) + ' s'))
    if (typeof value.outputTokens === 'number') parts.push(el('span', { className: 'lp-detail', key: 'tokens' }, '输出 ' + value.outputTokens + ' tok'))
    if (value.failure !== null && value.failure !== undefined) {
      const failure = value.failure
      parts.push(el('span', { className: 'lp-detail', key: 'failure' }, (failure.message ?? '未知失败') + ' (' + (failure.code ?? '?') + (typeof failure.status === 'number' ? ' · HTTP ' + failure.status : '') + ')'))
    }
  }
  return el('span', { className: 'lp-chip-row', key: 'result' }, parts)
}

function Toast({ notice, error, diagnostics }) {
  const children = []
  if (notice !== null && notice !== undefined) children.push(el('div', { className: 'lp-banner lp-banner-info', key: 'notice' }, notice))
  if (error !== null && error !== undefined) {
    children.push(el('div', { className: 'lp-banner lp-banner-error', key: 'error' },
      el('div', null, '操作失败：' + errorText(error)),
      Array.isArray(error.diagnostics) && error.diagnostics.length > 0
        ? el('ul', { className: 'lp-error-list', key: 'diagnostics' }, error.diagnostics.map((diagnostic, index) => el('li', { key: index }, diagnostic.message ?? String(diagnostic))))
        : null,
    ))
  }
  if (Array.isArray(diagnostics) && diagnostics.length > 0) {
    children.push(el('details', { className: 'lp-banner lp-banner-warn', key: 'diagnostics' },
      el('summary', null, `配置诊断（${diagnostics.length}）`),
      el('ul', { className: 'lp-error-list' }, diagnostics.map((diagnostic, index) => el('li', { key: index }, diagnostic.message ?? String(diagnostic)))),
    ))
  }
  return children.length === 0 ? null : el('div', null, children)
}

function PoolCard({ pool, data, tests, onEdit, onDelete, onTest }) {
  const now = Date.now()
  const recent = (data.recent ?? []).filter((attempt) => attempt.pool === pool.id).slice(-10).reverse()
  const routeRows = (pool.routes ?? []).map((route) => {
    const cooldown = formatCooldown(route.cooldownUntil)
    return el('tr', { key: route.model + '\u0000' + route.member + '\u0000' + route.targetModel },
      el('td', null, route.model),
      el('td', null, route.member),
      el('td', { className: 'lp-nowrap' }, route.targetModel),
      el('td', null, String(route.success ?? 0)),
      el('td', null, String(route.failure ?? 0)),
      el('td', null, cooldown === null ? '正常' : `冷却 ${cooldown}`),
      el('td', null, route.lastCode === null || route.lastCode === undefined ? '—' : String(route.lastCode)),
      el('td', null, route.lastMessage === null || route.lastMessage === undefined ? '' : String(route.lastMessage).slice(0, 80)),
    )
  })
  const assignment = (pool.preferred ?? []).filter((entry) => entry.sessions > 0)
  const overrides = (pool.overrides ?? []).filter((entry) => entry.sessions > 0)
  const modelRows = (pool.models ?? []).map((model) => {
    const targets = model.targets ?? {}
    const testKey = keyOf(pool.id, model.id)
    const result = tests[testKey]
    return el('div', { className: 'lp-model', key: model.id },
      el('span', { className: 'lp-model-id', key: 'id' }, model.id),
      model.name !== model.id ? el('span', { className: 'lp-model-name', key: 'name' }, model.name) : null,
      el('span', { className: 'lp-chip-row', key: 'targets' }, Object.entries(targets).map(([member, target]) => el('span', { className: 'lp-target', key: member }, member + ' → ' + target))),
      el('span', { className: 'lp-model-actions', key: 'actions' },
        el(PoolResultBadge, { result, key: 'result' }),
        el('button', { className: 'lp-btn', type: 'button', disabled: result !== undefined && result.status === 'running', onClick: () => onTest(pool.id, model.id) }, result !== undefined && result.status === 'running' ? '测试中…' : '测试'),
      ),
    )
  })
  return el('div', { className: 'lp-pool' },
    el('div', { className: 'lp-pool-head' },
      el('span', { className: 'lp-pool-name' }, pool.displayName),
      el('span', { className: 'lp-badge' }, pool.id),
      el('span', { className: 'lp-badge' }, STRATEGY_LABELS[pool.strategy] ?? pool.strategy),
      el('span', { className: 'lp-badge' }, `${pool.members?.length ?? 0} 个渠道 · ${pool.models?.length ?? 0} 个模型`),
      el('span', { className: 'lp-model-actions' },
        el('button', { className: 'lp-btn', type: 'button', onClick: () => onEdit(pool.id) }, '编辑'),
        el('button', { className: 'lp-btn lp-btn-danger', type: 'button', onClick: () => onDelete(pool.id) }, '删除'),
      ),
    ),
    el('div', { className: 'lp-pool-stats' },
      assignment.length === 0 ? '会话分配：暂无' : '会话分配：' + assignment.map((entry) => `${entry.member} ${entry.sessions}`).join(' · '),
      overrides.length === 0 ? '' : '；模型覆盖：' + overrides.map((entry) => `${entry.model}→${entry.member} ${entry.sessions}`).join(' · '),
    ),
    modelRows.length === 0 ? el('div', { className: 'lp-empty' }, '这个池还没有统一模型。点“编辑”添加或从成员模型自动聚合。') : el('div', null, modelRows),
    routeRows.length > 0
      ? el('details', { className: 'lp-fold' },
          el('summary', null, '渠道健康与冷却'),
          el('table', { className: 'lp-table' },
            el('thead', null, el('tr', null,
              el('th', null, '统一模型'), el('th', null, '渠道'), el('th', null, '目标模型'), el('th', null, '成功'), el('th', null, '失败'), el('th', null, '状态'), el('th', null, '最后错误码'), el('th', null, '最后错误'),
            )),
            el('tbody', null, routeRows),
          ),
        )
      : null,
    recent.length > 0
      ? el('details', { className: 'lp-fold' },
          el('summary', null, '最近调用'),
          el('table', { className: 'lp-table' },
            el('thead', null, el('tr', null,
              el('th', null, '时间'), el('th', null, '会话'), el('th', null, '统一模型'), el('th', null, '实际渠道'), el('th', null, '结果'), el('th', null, '耗时'), el('th', null, '错误'),
            )),
            el('tbody', null, recent.map((attempt, index) => el('tr', { key: attempt.at + ':' + index },
              el('td', { className: 'lp-nowrap' }, formatTime(attempt.at)),
              el('td', { className: 'lp-nowrap' }, shortSession(attempt.sessionId)),
              el('td', null, attempt.model),
              el('td', { className: 'lp-nowrap' }, attempt.member + ' → ' + attempt.targetModel),
              el('td', null, attempt.outcome === 'success' ? '成功' : '失败'),
              el('td', { className: 'lp-nowrap' }, typeof attempt.latencyMs === 'number' ? (attempt.latencyMs / 1000).toFixed(2) + ' s' : '—'),
              el('td', null, attempt.code ?? ''),
            ))),
          ),
        )
      : null,
  )
}

function MemberPicker({ draft, onChange }) {
  const selected = draft.members
  const available = Array.from(draft.available.values())
  const missing = selected.filter((member) => !draft.available.has(member))
  const allRows = [...available, ...missing.map((member) => ({ id: member, name: member, models: [], missing: true }))]
  const left = allRows.map((provider) => {
    const checked = selected.includes(provider.id)
    return el('label', { className: 'lp-member', key: provider.id },
      el('input', {
        type: 'checkbox',
        checked,
        onChange: (event) => {
          if (event.target.checked) {
            if (!selected.includes(provider.id)) onChange([...selected, provider.id])
          } else {
            onChange(selected.filter((member) => member !== provider.id))
          }
        },
      }),
      el('span', null, provider.name ?? provider.id),
      el('span', { className: 'lp-member-id' }, provider.id),
      provider.missing === true ? el('span', { className: 'lp-badge lp-badge-warn' }, '未注册') : null,
      provider.error !== null && provider.error !== undefined ? el('span', { className: 'lp-badge lp-badge-warn' }, '目录异常') : null,
    )
  })
  const move = (index, delta) => {
    const next = [...selected]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }
  const right = selected.map((member, index) => el('div', { className: 'lp-member', key: member },
    el('span', null, String(index + 1) + '.'),
    el('span', null, draft.available.get(member)?.name ?? member),
    el('span', { className: 'lp-member-id' }, member),
    el('span', { className: 'lp-member-actions' },
      el('button', { className: 'lp-mini', type: 'button', disabled: index === 0, onClick: () => move(index, -1) }, '上移'),
      el('button', { className: 'lp-mini', type: 'button', disabled: index === selected.length - 1, onClick: () => move(index, 1) }, '下移'),
      el('button', { className: 'lp-mini', type: 'button', onClick: () => onChange(selected.filter((item) => item !== member)) }, '移除'),
    ),
  ))
  return el('div', { className: 'lp-members' },
    el('div', null, el('div', { className: 'lp-hint' }, '可选的真实渠道（勾选加入，右侧可调整顺序）'), el('div', { className: 'lp-member-list' }, left)),
    el('div', null, el('div', { className: 'lp-hint' }, '轮询/分配顺序'), selected.length === 0 ? el('div', { className: 'lp-empty' }, '尚未选择成员') : el('div', { className: 'lp-member-list' }, right)),
  )
}

function ModelEditor({ draft, model, index, onChange, onRemove, available }) {
  const update = (patch) => onChange({ ...model, ...patch })
  const targetFields = draft.members.map((member) => {
    const provider = available.get(member)
    const models = provider !== undefined && Array.isArray(provider.models) ? provider.models : []
    if (provider === undefined) {
      return el('label', { className: 'lp-target-field', key: member },
        el('span', null, member + '（未注册，手填目标模型）'),
        el('input', {
          value: model.targets[member] ?? '',
          placeholder: model.id || '目标模型 id',
          onChange: (event) => update({ targets: { ...model.targets, [member]: event.target.value } }),
        }),
      )
    }
    return el('label', { className: 'lp-target-field', key: member },
      el('span', null, member),
      el('select', {
        value: model.targets[member] ?? '',
        onChange: (event) => {
          const targets = { ...model.targets }
          if (event.target.value.length === 0) delete targets[member]
          else targets[member] = event.target.value
          update({ targets })
        },
      },
        el('option', { value: '' }, '不提供'),
        models.map((candidate) => el('option', { value: candidate.id, key: candidate.id }, candidate.id + (candidate.name !== candidate.id ? ' · ' + candidate.name : ''))),
      ),
    )
  })
  return el('div', { className: 'lp-model-editor' },
    el('div', { className: 'lp-model-editor-head' },
      el('label', { className: 'lp-field', style: { flex: '1 1 180px' } },
        el('span', null, '统一模型 ID'),
        el('input', { value: model.id, placeholder: '例如 model-a', onChange: (event) => update({ id: event.target.value }) }),
      ),
      el('label', { className: 'lp-field', style: { flex: '1 1 180px' } },
        el('span', null, '显示名称（可选）'),
        el('input', { value: model.name, placeholder: model.id || '显示名称', onChange: (event) => update({ name: event.target.value }) }),
      ),
      el('label', { className: 'lp-field', style: { flex: '0 1 140px' } },
        el('span', null, '上下文窗口（可选）'),
        el('input', { value: model.contextWindow, inputMode: 'numeric', placeholder: '自动取最小', onChange: (event) => update({ contextWindow: event.target.value }) }),
      ),
      el('label', { className: 'lp-field', style: { flex: '0 1 140px' } },
        el('span', null, '最大输出（可选）'),
        el('input', { value: model.maxTokens, inputMode: 'numeric', placeholder: '自动取最小', onChange: (event) => update({ maxTokens: event.target.value }) }),
      ),
      el('button', { className: 'lp-btn lp-btn-danger', type: 'button', onClick: onRemove }, '删除模型'),
    ),
    el('div', { className: 'lp-targets' }, targetFields),
    el('div', { className: 'lp-hint', style: { marginTop: '6px' } }, '高级字段（推理档位映射、输入类型、冷却）可通过右上角“高级 JSON”编辑；切换表单编辑时这些字段会保留。'),
  )
}

function PoolEditor({ data, draft, setDraft, onSave, onCancel, saving }) {
  const [errors, setErrors] = React.useState([])
  const [commonOnly, setCommonOnly] = React.useState(true)
  const providerModelsList = (member) => {
    const provider = draft.available.get(member)
    return provider !== undefined && Array.isArray(provider.models) ? provider.models : []
  }
  const setMembers = (members) => {
    const nextModels = draft.models.map((model) => {
      const targets = { ...model.targets }
      for (const key of Object.keys(targets)) if (!members.includes(key)) delete targets[key]
      for (const member of members) {
        if (typeof targets[member] === 'string' && targets[member].length > 0) continue
        const candidates = providerModelsList(member)
        if (candidates.some((candidate) => candidate.id === model.id)) targets[member] = model.id
      }
      return { ...model, targets }
    })
    setDraft({ ...draft, members, models: nextModels })
  }
  const addModel = () => {
    setDraft({ ...draft, models: [...draft.models, { id: '', name: '', targets: {}, contextWindow: '', maxTokens: '' }] })
  }
  const updateModel = (index, next) => {
    const models = [...draft.models]
    models[index] = next
    setDraft({ ...draft, models })
  }
  const removeModel = (index) => {
    setDraft({ ...draft, models: draft.models.filter((_, item) => item !== index) })
  }
  const autoAggregate = () => {
    const members = draft.members
    if (members.length === 0) {
      setErrors(['请先选择成员渠道'])
      return
    }
    const counts = new Map()
    for (const member of members) for (const model of providerModelsList(member)) counts.set(model.id, (counts.get(model.id) ?? 0) + 1)
    const threshold = commonOnly ? Math.min(2, members.length) : 1
    const existing = new Map(draft.models.map((model) => [model.id, model]))
    const added = []
    const seen = new Set()
    for (const member of members) {
      for (const candidate of providerModelsList(member)) {
        if (seen.has(candidate.id)) continue
        seen.add(candidate.id)
        if ((counts.get(candidate.id) ?? 0) < threshold) continue
        if (existing.has(candidate.id)) continue
        const targets = {}
        for (const item of members) {
          if (providerModelsList(item).some((model) => model.id === candidate.id)) targets[item] = candidate.id
        }
        added.push({ id: candidate.id, name: candidate.name ?? candidate.id, targets, contextWindow: '', maxTokens: '' })
      }
    }
    if (added.length === 0) {
      setErrors(['没有找到可自动聚合的新模型'])
      return
    }
    setErrors([])
    setDraft({ ...draft, models: [...draft.models, ...added] })
  }
  const submit = () => {
    const validation = validateDraft(draft, data)
    setErrors(validation)
    if (validation.length === 0) onSave(draft)
  }
  return el('div', { className: 'lp-form' },
    el('div', { className: 'lp-editor-head' },
      el('span', { className: 'lp-editor-title' }, draft.originalId === null ? '新建统一服务商' : `编辑统一服务商 · ${draft.originalId}`),
      el('span', { className: 'lp-hint' }, '保存后立即热加载；正在进行的会话下次调用生效。'),
    ),
    el('div', { className: 'lp-form-grid' },
      el('label', { className: 'lp-field' },
        el('span', null, '统一服务商 ID（模型选择器里的路由名）'),
        el('input', { value: draft.id, disabled: draft.originalId !== null, placeholder: '例如 pool-a', onChange: (event) => setDraft({ ...draft, id: event.target.value }) }),
        el('small', null, draft.originalId !== null ? 'ID 作为会话选择持久化，建议不要修改。' : '不能与真实渠道重名；保存后不可随意更改。'),
      ),
      el('label', { className: 'lp-field' },
        el('span', null, '显示名称'),
        el('input', { value: draft.displayName, placeholder: draft.id || '例如 Example Pool', onChange: (event) => setDraft({ ...draft, displayName: event.target.value }) }),
      ),
      el('label', { className: 'lp-field' },
        el('span', null, '分配策略'),
        el('select', { value: draft.strategy, onChange: (event) => setDraft({ ...draft, strategy: event.target.value }) },
          el('option', { value: 'sticky' }, '会话粘性（推荐，省缓存）'),
          el('option', { value: 'round-robin' }, '每次调用轮询'),
          el('option', { value: 'failover' }, '主备切换（固定第一个可用渠道）'),
        ),
        el('small', null, '粘性：新会话按全局负载均衡分到一个渠道，之后一直用它；失败自动切换并粘在新渠道。'),
      ),
    ),
    el('div', { className: 'lp-section' },
      el('div', { className: 'lp-section-title' }, '成员渠道'),
      el(MemberPicker, { draft, onChange: setMembers }),
    ),
    el('div', { className: 'lp-section' },
      el('div', { className: 'lp-section-title' }, '统一模型'),
      el('div', { className: 'lp-hint' }, '统一模型是模型选择器里显示的模型；每个成员可以映射到不同的实际模型。'),
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' } },
        el('button', { className: 'lp-btn', type: 'button', onClick: autoAggregate }, '从成员模型自动聚合'),
        el('label', { className: 'lp-hint', style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
          el('input', { type: 'checkbox', checked: commonOnly, onChange: (event) => setCommonOnly(event.target.checked) }),
          '只包含至少两个渠道共有的模型',
        ),
        el('button', { className: 'lp-btn', type: 'button', onClick: addModel }, '添加统一模型'),
      ),
      draft.models.length === 0 ? el('div', { className: 'lp-empty' }, '还没有模型。可以先自动聚合，或手动添加。') : null,
      draft.models.map((model, index) => el(ModelEditor, {
        key: index,
        draft,
        model,
        index,
        available: draft.available,
        onChange: (next) => updateModel(index, next),
        onRemove: () => removeModel(index),
      })),
    ),
    errors.length > 0 ? el('div', { className: 'lp-banner lp-banner-error' },
      el('div', null, '请先修正以下问题：'),
      el('ul', { className: 'lp-error-list' }, errors.map((message, index) => el('li', { key: index }, message))),
    ) : null,
    el('div', { className: 'lp-footer' },
      el('button', { className: 'lp-btn', type: 'button', disabled: saving, onClick: onCancel }, '取消'),
      el('button', { className: 'lp-btn lp-btn-primary', type: 'button', disabled: saving, onClick: submit }, saving ? '保存中…' : '保存'),
    ),
  )
}

function AdvancedEditor({ text, setText, onSave, onCancel, saving }) {
  const [error, setError] = React.useState(null)
  const save = () => {
    let parsed
    try {
      parsed = JSON.parse(text)
    } catch (parseError) {
      setError('JSON 解析失败：' + errorText(parseError))
      return
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.providers === null || typeof parsed.providers !== 'object' || Array.isArray(parsed.providers)) {
      setError('根对象必须包含 providers 对象')
      return
    }
    setError(null)
    onSave({ providers: parsed.providers, retryPolicy: parsed.retryPolicy })
  }
  return el('div', { className: 'lp-form' },
    el('div', { className: 'lp-editor-head' },
      el('span', { className: 'lp-editor-title' }, '高级 JSON'),
      el('span', { className: 'lp-hint' }, '直接编辑完整的统一服务商配置；适合设置推理档位映射、输入类型、冷却等高级字段。'),
    ),
    el('label', { className: 'lp-field' },
      el('span', null, '配置 JSON'),
      el('textarea', { value: text, onChange: (event) => setText(event.target.value), spellCheck: false }),
    ),
    error === null ? null : el('div', { className: 'lp-banner lp-banner-error' }, error),
    el('div', { className: 'lp-footer' },
      el('button', { className: 'lp-btn', type: 'button', disabled: saving, onClick: onCancel }, '取消'),
      el('button', { className: 'lp-btn lp-btn-primary', type: 'button', disabled: saving, onClick: save }, saving ? '保存中…' : '保存'),
    ),
  )
}

function PoolPanel() {
  const [state, setState] = React.useState({ phase: 'loading', data: null, error: null, notice: null })
  const [editing, setEditing] = React.useState(null)
  const [advanced, setAdvanced] = React.useState(null)
  const [tests, setTests] = React.useState({})
  const [saving, setSaving] = React.useState(false)

  const refresh = async (silent = false) => {
    if (!silent) setState((previous) => ({ ...previous, phase: 'loading', error: null }))
    try {
      const data = await loadStatus()
      setState((previous) => ({ ...previous, phase: 'ready', data, error: null }))
      return data
    } catch (error) {
      setState((previous) => ({ ...previous, phase: 'error', error }))
      return null
    }
  }

  React.useEffect(() => { refresh() }, [])

  const pollFor = async (predicate) => {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      await sleep(500)
      try {
        const data = await loadStatus()
        if (predicate(data)) {
          setState((previous) => ({ ...previous, phase: 'ready', data, error: null }))
          return data
        }
      } catch (error) {
        // the plugin is being reloaded; keep polling
      }
    }
    return null
  }

  const submit = async (providers, predicate, retryPolicy) => {
    const data = state.data
    if (data === null) return
    setSaving(true)
    setState((previous) => ({ ...previous, notice: '已提交，正在应用…', error: null }))
    try {
      const body = { providers }
      if (retryPolicy !== undefined) body.retryPolicy = retryPolicy
      else if (data.config?.retryPolicy !== undefined) body.retryPolicy = data.config.retryPolicy
      await postJson('/llm-pool/save', body)
      const applied = await pollFor(predicate)
      if (applied === null) throw new Error('配置已提交，但新配置未在超时内生效；请刷新页面或查看 Host 日志')
      setEditing(null)
      setAdvanced(null)
      setState((previous) => ({ ...previous, notice: '已保存并生效', error: null }))
    } catch (error) {
      setState((previous) => ({ ...previous, notice: null, error }))
    } finally {
      setSaving(false)
    }
  }

  const saveDraft = (draft) => {
    const poolId = draft.id.trim()
    const pool = buildPoolFromDraft(draft)
    const providers = mergeProviders(state.data, poolId, pool, false)
    submit(providers, (data) => {
      const statusPool = data.pools?.find((candidate) => candidate.id === poolId)
      if (statusPool === undefined) return false
      if (statusPool.displayName !== pool.displayName) return false
      if (statusPool.strategy !== pool.strategy) return false
      if (!sameJson(statusPool.members, pool.members)) return false
      if ((statusPool.models?.length ?? 0) !== pool.models.length) return false
      for (const model of pool.models) {
        const found = statusPool.models.find((candidate) => candidate.id === model.id)
        if (found === undefined) return false
        if (!sameJson(found.targets, model.targets)) return false
      }
      return true
    })
  }

  const deletePool = (poolId) => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(`删除统一服务商 "${poolId}"？正在使用它的会话会失去该模型选择。`)) return
    }
    const providers = mergeProviders(state.data, poolId, null, true)
    submit(providers, (data) => data.config?.providers?.[poolId] === undefined)
  }

  const testOne = async (poolId, modelId) => {
    const key = keyOf(poolId, modelId)
    setTests((previous) => ({ ...previous, [key]: { status: 'running' } }))
    try {
      const result = await postJson('/llm-pool/test', { provider: poolId, model: modelId })
      setTests((previous) => ({ ...previous, [key]: { status: 'done', ok: result.ok === true, result } }))
    } catch (error) {
      setTests((previous) => ({
        ...previous,
        [key]: { status: 'done', ok: false, result: { ok: false, failure: { message: errorText(error), code: 'HTTP_ERROR' } } },
      }))
    }
  }

  const openEdit = (poolId) => {
    const raw = state.data?.config?.providers?.[poolId]
    if (raw === null || raw === undefined) return
    setEditing(draftFromRawPool(state.data, poolId, raw))
    setAdvanced(null)
  }

  const openNew = () => {
    setEditing(emptyDraft(state.data))
    setAdvanced(null)
  }

  const openAdvanced = () => {
    setAdvanced({ text: JSON.stringify(buildAdvancedConfig(state.data), null, 2) })
    setEditing(null)
  }

  const data = state.data
  const diagnostics = Array.isArray(data?.diagnostics) ? data.diagnostics : []
  const pools = Array.isArray(data?.pools) ? data.pools : []

  let body
  if (advanced !== null) {
    body = el(AdvancedEditor, {
      text: advanced.text,
      setText: (text) => setAdvanced({ ...advanced, text }),
      saving,
      onCancel: () => setAdvanced(null),
      onSave: (config) => {
        const expected = config.providers
        submit(config.providers, (data) => sameJson(data.config?.providers ?? {}, expected), config.retryPolicy)
      },
    })
  } else if (editing !== null) {
    body = el(PoolEditor, {
      data,
      draft: editing,
      setDraft: setEditing,
      saving,
      onCancel: () => setEditing(null),
      onSave: saveDraft,
    })
  } else if (state.phase === 'loading') {
    body = el('div', { className: 'lp-empty' }, '正在加载统一服务商配置…')
  } else if (state.phase === 'error') {
    body = el('div', { className: 'lp-banner lp-banner-error' }, '加载失败：' + errorText(state.error))
  } else {
    body = el('div', null,
      pools.length === 0 ? el('div', { className: 'lp-empty' }, '还没有统一服务商。点“新增统一服务商”创建第一个；配置会写入当前 profile 的 cordis.patch.yml。') : null,
      pools.map((pool) => el(PoolCard, {
        key: pool.id,
        pool,
        data,
        tests,
        onEdit: openEdit,
        onDelete: deletePool,
        onTest: testOne,
      })),
    )
  }

  return el('div', { className: 'lp-panel' },
    el('div', { className: 'lp-head' },
      el('div', null,
        el('div', { className: 'lp-title' }, '统一服务商池'),
        el('div', { className: 'lp-sub' }, '把多个真实模型渠道组合成统一服务商：会话粘性分配、全局均衡、失败自动切换。选择器里出现的是这里的统一模型。'),
      ),
      el('div', { className: 'lp-actions' },
        el('button', { className: 'lp-btn', type: 'button', disabled: saving, onClick: () => refresh() }, '刷新'),
        el('button', { className: 'lp-btn', type: 'button', disabled: saving || data === null, onClick: openAdvanced }, '高级 JSON'),
        el('button', { className: 'lp-btn lp-btn-primary', type: 'button', disabled: saving || data === null, onClick: openNew }, '新增统一服务商'),
      ),
    ),
    el(Toast, { notice: state.notice, error: state.error, diagnostics }),
    body,
    data !== null && data.writable === false
      ? el('div', { className: 'lp-banner lp-banner-warn', style: { marginTop: '10px' } }, '当前部署没有可写的 profile 配置（configEditor 未挂载或条目不可寻址），面板只能查看。')
      : null,
  )
}

exports.inject = ['slots']

exports.apply = function apply(ctx) {
  const slots = ctx.get('slots')
  if (slots === undefined) return

  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = 'dsh-llm-pool'
    tag.dataset.pluginCss = 'dsh-llm-pool/panel.css'
    tag.textContent = CSS
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, 'llm-pool: panel stylesheet')

  slots.inject('settings.models.footer', () => slots.register(
    { name: 'settings.models.footer', id: 'llm-pool-footer' },
    PoolPanel,
  ))
}

return module.exports; } });
