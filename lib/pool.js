/**
 * Pure configuration, capability-composition, and failure logic for dsh-llm-pool.
 *
 * This module imports nothing but standard JavaScript built-ins so the plugin
 * package can be installed into a DSH profile without additional dependencies.
 */

export const PLUGIN_NAME = 'dsh-llm-pool'
export const PLUGIN_VERSION = '0.1.1'

export const STRATEGIES = ['sticky', 'round-robin', 'failover']
export const STRATEGY_LABELS = {
  sticky: '会话粘性（省缓存，默认）',
  'round-robin': '每次调用轮询',
  failover: '主备切换',
}

export const DEFAULT_CONTEXT_WINDOW = 262144

export const DEFAULT_RETRYABLE_CODES = [
  'EMPTY_RESPONSE',
  'RATE_LIMIT',
  'SERVER',
  'TIMEOUT',
  'TRANSPORT',
]

export const DEFAULT_RETRY_POLICY = Object.freeze({
  mode: 'normal',
  maxRetries: 2,
  retryableCodes: Object.freeze([...DEFAULT_RETRYABLE_CODES]),
  initialDelayMs: 500,
  maxDelayMs: 10000,
  jitterRatio: 0.1,
})

export const DEFAULT_COOLDOWNS = Object.freeze({
  authMs: 10 * 60_000,
  quotaMs: 10 * 60_000,
  rateLimitMs: 60_000,
  serverMs: 30_000,
  timeoutMs: 30_000,
  transportMs: 30_000,
  emptyMs: 15_000,
  maxMs: 15 * 60_000,
})

const ROUTE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const TEST_SESSION_PREFIX = 'llm-pool-test:'

/** @param {unknown} value */
export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {unknown} value */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0
}

/** @param {unknown} value */
function asString(value) {
  return typeof value === 'string' ? value : undefined
}

/** @param {unknown} value */
export function asPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/** @param {unknown} value */
function asBoolean(value) {
  return value === true
}

/** @param {unknown} value */
export function isValidRouteId(value) {
  return typeof value === 'string' && ROUTE_ID.test(value)
}

/** @param {unknown} sessionId */
export function isTestSession(sessionId) {
  return typeof sessionId === 'string' && sessionId.startsWith(TEST_SESSION_PREFIX)
}

/** @param {unknown} sessionId */
export function testMemberFromSession(sessionId) {
  if (!isTestSession(sessionId)) return undefined
  const rest = sessionId.slice(TEST_SESSION_PREFIX.length)
  const member = rest.split(':', 1)[0]
  if (member === undefined || member.length === 0) return undefined
  try {
    return decodeURIComponent(member)
  } catch {
    return member
  }
}

/** @param {unknown} sessionId */
export function testSessionId(member) {
  return `${TEST_SESSION_PREFIX}${member === undefined ? '' : encodeURIComponent(member)}:${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Scope key used by sticky assignments. Test calls deliberately do not own an
 * assignment; calls without a Session share one anonymous scope.
 * @param {unknown} sessionId
 * @returns {string | null}
 */
export function scopeKey(sessionId) {
  if (isTestSession(sessionId)) return null
  return isNonEmptyString(sessionId) ? sessionId : '__anonymous__'
}

/** @param {string[]} diagnostics */
function pushDiagnostic(diagnostics, level, message, extra = {}) {
  diagnostics.push({ level, message, ...extra })
}

/** @param {unknown[]} values */
function uniqueStrings(values) {
  const seen = new Set()
  const out = []
  for (const value of values) {
    if (!isNonEmptyString(value) || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out
}

/** @param {unknown} raw */
function normalizeInput(raw, diagnostics, poolId, modelId) {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 input 不是数组，已忽略`, { pool: poolId, model: modelId })
    return undefined
  }
  const values = uniqueStrings(raw.filter((value) => value === 'text' || value === 'image'))
  if (values.length === 0) {
    pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 input 不含 text/image，已忽略`, { pool: poolId, model: modelId })
    return undefined
  }
  return values
}

/** @param {unknown} raw */
function normalizeEfforts(raw, diagnostics, poolId, modelId) {
  if (raw === undefined) return undefined
  if (!Array.isArray(raw)) {
    pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 efforts 不是数组，已忽略`, { pool: poolId, model: modelId })
    return undefined
  }
  const seen = new Set()
  const efforts = []
  for (const entry of raw) {
    let id
    let name
    if (typeof entry === 'string') {
      id = entry
      name = entry
    } else if (isRecord(entry) && isNonEmptyString(entry.id)) {
      id = entry.id
      name = isNonEmptyString(entry.name) ? entry.name : entry.id
    }
    if (!id || seen.has(id)) continue
    seen.add(id)
    efforts.push({ id, name: name ?? id })
  }
  if (efforts.length === 0) {
    pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 efforts 没有有效项，已忽略`, { pool: poolId, model: modelId })
    return undefined
  }
  return efforts
}

/** @param {unknown} raw */
function normalizeEffortMap(raw, members, diagnostics, poolId, modelId) {
  if (raw === undefined) return undefined
  if (!isRecord(raw)) {
    pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 effortMap 不是对象，已忽略`, { pool: poolId, model: modelId })
    return undefined
  }
  const out = {}
  for (const [member, mapping] of Object.entries(raw)) {
    if (!members.includes(member)) {
      pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 effortMap 引用了未在 members 中的 "${member}"，已忽略`, { pool: poolId, model: modelId })
      continue
    }
    if (!isRecord(mapping)) {
      pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 effortMap["${member}"] 不是对象，已忽略`, { pool: poolId, model: modelId })
      continue
    }
    const normalized = {}
    for (const [from, to] of Object.entries(mapping)) {
      if (!isNonEmptyString(from) || !isNonEmptyString(to)) {
        pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 effortMap["${member}"] 含无效项，已忽略`, { pool: poolId, model: modelId })
        continue
      }
      normalized[from] = to
    }
    if (Object.keys(normalized).length > 0) out[member] = normalized
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Normalize a model's target map. An omitted targets field means "same model id
 * on every member"; an explicit map (or array of {member, model}) limits the
 * members that actually serve this unified model.
 * @param {unknown} raw
 */
function normalizeTargets(raw, modelId, members, diagnostics, poolId) {
  if (raw === undefined) {
    return {
      specified: false,
      targets: members.map((member) => ({ member, model: modelId })),
    }
  }
  const collected = new Map()
  const accept = (member, value) => {
    if (!isNonEmptyString(member)) return
    if (!members.includes(member)) {
      pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的目标引用了未在 members 中的 "${member}"，已忽略`, { pool: poolId, model: modelId })
      return
    }
    let targetModel
    if (typeof value === 'string') targetModel = value
    else if (isRecord(value) && isNonEmptyString(value.model)) targetModel = value.model
    if (!isNonEmptyString(targetModel)) {
      pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 在渠道 "${member}" 上的目标模型为空，已忽略`, { pool: poolId, model: modelId })
      return
    }
    if (!collected.has(member)) collected.set(member, targetModel)
  }
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (isRecord(entry)) accept(entry.member, entry.model)
    }
  } else if (isRecord(raw)) {
    for (const [member, value] of Object.entries(raw)) accept(member, value)
  } else {
    pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 targets 不是对象或数组，已忽略`, { pool: poolId, model: modelId })
  }
  const targets = members
    .filter((member) => collected.has(member))
    .map((member) => ({ member, model: collected.get(member) }))
  if (targets.length === 0) {
    pushDiagnostic(diagnostics, 'error', `模型 "${modelId}" 没有任何可用的目标渠道，已跳过`, { pool: poolId, model: modelId })
    return { specified: true, targets: [] }
  }
  return { specified: true, targets }
}

/** @param {unknown} raw */
function normalizeCooldowns(raw, diagnostics, poolId) {
  const values = { ...DEFAULT_COOLDOWNS }
  if (raw === undefined) return { values, specified: {} }
  if (!isRecord(raw)) {
    pushDiagnostic(diagnostics, 'warn', `统一服务商 "${poolId}" 的 cooldown 不是对象，已忽略`, { pool: poolId })
    return { values, specified: {} }
  }
  const specified = {}
  for (const key of Object.keys(DEFAULT_COOLDOWNS)) {
    const value = raw[key]
    if (value === undefined) continue
    if (Number.isSafeInteger(value) && value > 0) {
      values[key] = value
      specified[key] = value
    } else {
      pushDiagnostic(diagnostics, 'warn', `统一服务商 "${poolId}" 的 cooldown.${key} 必须是正整数，已忽略`, { pool: poolId })
    }
  }
  return { values, specified }
}

/**
 * @param {string} id
 * @param {unknown} raw
 * @param {Array<object>} diagnostics
 */
function normalizePool(id, raw, diagnostics) {
  if (!isRecord(raw)) {
    pushDiagnostic(diagnostics, 'error', `统一服务商 "${id}" 的配置不是对象，已跳过`, { pool: id })
    return undefined
  }
  const rawMembers = Array.isArray(raw.members) ? raw.members : []
  if (!Array.isArray(raw.members)) pushDiagnostic(diagnostics, 'warn', `统一服务商 "${id}" 的 members 不是数组`, { pool: id })
  const members = uniqueStrings(rawMembers)
  if (members.length === 0) {
    pushDiagnostic(diagnostics, 'error', `统一服务商 "${id}" 没有有效 members，已跳过`, { pool: id })
    return undefined
  }

  const strategy = STRATEGIES.includes(raw.strategy) ? raw.strategy : 'sticky'
  if (raw.strategy !== undefined && !STRATEGIES.includes(raw.strategy)) {
    pushDiagnostic(diagnostics, 'warn', `统一服务商 "${id}" 的 strategy="${String(raw.strategy)}" 无效，改用 sticky`, { pool: id })
  }
  const displayName = isNonEmptyString(raw.displayName) ? raw.displayName : id
  const cooldown = normalizeCooldowns(raw.cooldown, diagnostics, id)

  const rawModels = Array.isArray(raw.models) ? raw.models : []
  if (raw.models !== undefined && !Array.isArray(raw.models)) {
    pushDiagnostic(diagnostics, 'warn', `统一服务商 "${id}" 的 models 不是数组`, { pool: id })
  }
  const seenModels = new Set()
  const models = []
  for (const rawModel of rawModels) {
    if (!isRecord(rawModel) || !isNonEmptyString(rawModel.id)) {
      pushDiagnostic(diagnostics, 'warn', `统一服务商 "${id}" 含无效模型条目，已跳过`, { pool: id })
      continue
    }
    const modelId = rawModel.id
    if (seenModels.has(modelId)) {
      pushDiagnostic(diagnostics, 'warn', `统一服务商 "${id}" 的模型 "${modelId}" 重复，已跳过后者`, { pool: id, model: modelId })
      continue
    }
    seenModels.add(modelId)
    const targets = normalizeTargets(rawModel.targets, modelId, members, diagnostics, id)
    if (targets.targets.length === 0) continue
    const efforts = normalizeEfforts(rawModel.efforts, diagnostics, id, modelId)
    let defaultEffort = asString(rawModel.defaultEffort)
    if (defaultEffort !== undefined) {
      if (efforts === undefined || !efforts.some((effort) => effort.id === defaultEffort)) {
        pushDiagnostic(diagnostics, 'warn', `模型 "${modelId}" 的 defaultEffort 不在 efforts 中，已忽略`, { pool: id, model: modelId })
        defaultEffort = undefined
      }
    }
    models.push({
      id: modelId,
      name: isNonEmptyString(rawModel.name) ? rawModel.name : modelId,
      targets: targets.targets,
      targetsSpecified: targets.specified,
      contextWindow: asPositiveInteger(rawModel.contextWindow),
      maxTokens: asPositiveInteger(rawModel.maxTokens),
      input: normalizeInput(rawModel.input, diagnostics, id, modelId),
      efforts,
      defaultEffort,
      effortMap: normalizeEffortMap(rawModel.effortMap, members, diagnostics, id, modelId),
    })
  }

  return {
    id,
    displayName,
    strategy,
    members,
    models,
    cooldown: cooldown.values,
    cooldownSpecified: cooldown.specified,
  }
}

/**
 * Normalize one complete plugin config. Never throws: structural problems are
 * reported as diagnostics and unusable pools/models are omitted.
 * @param {unknown} raw
 */
export function normalizeConfig(raw) {
  const diagnostics = []
  const rawProviders = isRecord(raw) && isRecord(raw.providers) ? raw.providers : {}
  if (isRecord(raw) && raw.providers !== undefined && !isRecord(raw.providers)) {
    pushDiagnostic(diagnostics, 'error', 'config.providers 必须是对象，已按空配置处理')
  }
  const pools = []
  for (const [id, rawPool] of Object.entries(rawProviders)) {
    if (!isValidRouteId(id)) {
      pushDiagnostic(diagnostics, 'error', `统一服务商 id "${id}" 不是合法路由名（字母数字开头，可含 . _ -），已跳过`, { pool: id })
      continue
    }
    const pool = normalizePool(id, rawPool, diagnostics)
    if (pool !== undefined) pools.push(pool)
  }

  // A pool must not contain another pool as a member: that would recurse.
  const poolIds = new Set(pools.map((pool) => pool.id))
  const usable = []
  for (const pool of pools) {
    const keptMembers = pool.members.filter((member) => {
      if (!poolIds.has(member)) return true
      pushDiagnostic(diagnostics, 'error', `统一服务商 "${pool.id}" 的 member "${member}" 是另一个统一服务商，不允许嵌套，已移除`, { pool: pool.id })
      return false
    })
    if (keptMembers.length !== pool.members.length) {
      pool.members = keptMembers
      pool.models = pool.models.filter((model) => {
        model.targets = model.targets.filter((target) => keptMembers.includes(target.member))
        return model.targets.length > 0
      })
    }
    if (pool.members.length === 0) {
      pushDiagnostic(diagnostics, 'error', `统一服务商 "${pool.id}" 在移除嵌套成员后为空，已跳过`, { pool: pool.id })
      continue
    }
    usable.push(pool)
  }

  const retryPolicy = normalizeRetryPolicy(isRecord(raw) ? raw.retryPolicy : undefined, diagnostics)
  const providers = {}
  for (const pool of usable) providers[pool.id] = poolToConfig(pool)
  return { pools: usable, providers, retryPolicy, diagnostics }
}

/**
 * Normalize the provider-owned retry policy captured at adapter registration.
 * @param {unknown} raw
 * @param {Array<object>} diagnostics
 */
export function normalizeRetryPolicy(raw, diagnostics = []) {
  if (raw === undefined) return { ...DEFAULT_RETRY_POLICY, retryableCodes: [...DEFAULT_RETRY_POLICY.retryableCodes] }
  if (!isRecord(raw)) {
    pushDiagnostic(diagnostics, 'warn', 'config.retryPolicy 不是对象，使用默认值')
    return { ...DEFAULT_RETRY_POLICY, retryableCodes: [...DEFAULT_RETRY_POLICY.retryableCodes] }
  }
  const mode = raw.mode === 'always' ? 'always' : 'normal'
  if (raw.mode !== undefined && raw.mode !== 'always' && raw.mode !== 'normal') {
    pushDiagnostic(diagnostics, 'warn', `config.retryPolicy.mode="${String(raw.mode)}" 无效，改用 normal`)
  }
  const backoff = normalizeBackoff(raw.backoff, diagnostics)
  if (mode === 'always') return { mode, ...backoff }
  let maxRetries = DEFAULT_RETRY_POLICY.maxRetries
  if (raw.maxRetries !== undefined) {
    if (Number.isSafeInteger(raw.maxRetries) && raw.maxRetries >= 0 && raw.maxRetries <= 20) maxRetries = raw.maxRetries
    else pushDiagnostic(diagnostics, 'warn', 'config.retryPolicy.maxRetries 必须是 0..20 的整数，使用默认值 2')
  }
  let retryableCodes = [...DEFAULT_RETRYABLE_CODES]
  if (raw.retryableCodes !== undefined) {
    if (Array.isArray(raw.retryableCodes) && raw.retryableCodes.length > 0 && raw.retryableCodes.every((code) => isNonEmptyString(code))) {
      retryableCodes = uniqueStrings(raw.retryableCodes)
    } else {
      pushDiagnostic(diagnostics, 'warn', 'config.retryPolicy.retryableCodes 必须是非空字符串数组，使用默认值')
    }
  }
  return { mode, maxRetries, retryableCodes, ...backoff }
}

/** @param {unknown} raw */
function normalizeBackoff(raw, diagnostics) {
  const out = {
    initialDelayMs: DEFAULT_RETRY_POLICY.initialDelayMs,
    maxDelayMs: DEFAULT_RETRY_POLICY.maxDelayMs,
    jitterRatio: DEFAULT_RETRY_POLICY.jitterRatio,
  }
  if (raw === undefined) return out
  if (!isRecord(raw)) {
    pushDiagnostic(diagnostics, 'warn', 'config.retryPolicy.backoff 不是对象，使用默认值')
    return out
  }
  if (Number.isFinite(raw.initialDelayMs) && raw.initialDelayMs > 0 && raw.initialDelayMs <= 10 * 60_000) out.initialDelayMs = raw.initialDelayMs
  if (Number.isFinite(raw.maxDelayMs) && raw.maxDelayMs > 0 && raw.maxDelayMs <= 10 * 60_000) out.maxDelayMs = raw.maxDelayMs
  if (out.initialDelayMs > out.maxDelayMs) out.initialDelayMs = out.maxDelayMs
  if (Number.isFinite(raw.jitterRatio) && raw.jitterRatio >= 0 && raw.jitterRatio <= 1) out.jitterRatio = raw.jitterRatio
  return out
}

/**
 * Serialize one normalized pool back to the plugin config shape.
 * @param {object} pool
 */
export function poolToConfig(pool) {
  const models = pool.models.map((model) => {
    const targets = {}
    for (const target of model.targets) targets[target.member] = target.model
    return {
      id: model.id,
      ...(model.name !== model.id ? { name: model.name } : {}),
      targets,
      ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
      ...(model.maxTokens === undefined ? {} : { maxTokens: model.maxTokens }),
      ...(model.input === undefined ? {} : { input: [...model.input] }),
      ...(model.efforts === undefined
        ? {}
        : {
            efforts: model.efforts.map((effort) => (effort.id === effort.name ? effort.id : { id: effort.id, name: effort.name })),
          }),
      ...(model.defaultEffort === undefined ? {} : { defaultEffort: model.defaultEffort }),
      ...(model.effortMap === undefined ? {} : { effortMap: model.effortMap }),
    }
  })
  return {
    displayName: pool.displayName,
    strategy: pool.strategy,
    members: [...pool.members],
    models,
    ...(Object.keys(pool.cooldownSpecified ?? {}).length === 0 ? {} : { cooldown: { ...pool.cooldownSpecified } }),
  }
}

/** @param {object} pool */
export function findPoolModel(pool, modelId) {
  return pool.models.find((model) => model.id === modelId)
}

/**
 * Effective member → target-model list for one unified model.
 * @param {object} model
 * @returns {Array<{ member: string, model: string }>}
 */
export function modelTargets(model) {
  return model.targets
}

/**
 * Compose the unified model metadata accepted by dsh-llm.
 *
 * The merge is deliberately conservative where the loop relies on a capability
 * before dispatch (context window, output cap, reasoning, prompt/tool update),
 * and permissive where the inner adapter can still project the request itself
 * (images). Metadata resolution is fail-soft: it never throws, because a throw
 * would hide the whole provider group from the model picker.
 *
 * @param {object} pool
 * @param {object} model
 * @param {Array<{ member: string, targetModel: string, info?: object, error?: Error }>} targets
 * @param {{ contextWindow?: number, maxTokens?: number }} defaults
 */
export function mergeModelInfo(pool, model, targets, defaults = {}) {
  const infos = targets.filter((target) => target.info !== undefined).map((target) => target.info)
  const fallbackContext = asPositiveInteger(defaults.contextWindow) ?? DEFAULT_CONTEXT_WINDOW

  const contextValues = infos.map((info) => {
    const value = asPositiveInteger(info?.context?.contextWindow)
    return value ?? fallbackContext
  })
  const contextWindow = model.contextWindow ?? (contextValues.length > 0 ? Math.min(...contextValues) : fallbackContext)

  const outputValues = infos.map((info) => asPositiveInteger(info?.defaultMaxTokens)).filter((value) => value !== undefined)
  const defaultMaxTokens =
    model.maxTokens ??
    (outputValues.length > 0 ? Math.min(...outputValues) : asPositiveInteger(defaults.maxTokens))

  const reasoning = mergeReasoning(model, infos)

  let inputModalities
  if (model.input !== undefined) inputModalities = [...model.input]
  else if (infos.some((info) => Array.isArray(info?.inputModalities) && info.inputModalities.includes('image'))) {
    inputModalities = ['text', 'image']
  } else {
    inputModalities = ['text']
  }

  let systemPromptUpdate
  if (infos.length > 0 && infos.every((info) => info?.systemPromptUpdate === 'in-history')) systemPromptUpdate = 'in-history'

  let toolUpdate
  if (infos.length > 0) {
    if (infos.every((info) => info?.toolUpdate === 'in-history')) toolUpdate = 'in-history'
    else if (infos.every((info) => info?.toolUpdate === 'in-history' || info?.toolUpdate === 'addition-only')) {
      toolUpdate = 'addition-only'
    }
  }

  const info = {
    provider: pool.id,
    id: model.id,
    name: model.name,
    description: `统一模型 · ${model.targets.length} 个渠道 · ${STRATEGY_LABELS[pool.strategy] ?? pool.strategy}`,
    context: { contextWindow },
    ...(defaultMaxTokens === undefined ? {} : { defaultMaxTokens }),
    inputModalities,
    ...(systemPromptUpdate === undefined ? {} : { systemPromptUpdate }),
    ...(toolUpdate === undefined ? {} : { toolUpdate }),
  }
  if (reasoning !== undefined) info.reasoning = reasoning
  return info
}

/** @param {object} model @param {object[]} infos */
function mergeReasoning(model, infos) {
  let efforts
  if (model.efforts !== undefined && model.efforts.length > 0) {
    efforts = model.efforts.map((effort) => ({ ...effort }))
  } else if (infos.length > 0 && infos.every((info) => Array.isArray(info?.reasoning?.efforts) && info.reasoning.efforts.length > 0)) {
    const first = infos[0].reasoning.efforts
    efforts = first
      .filter((effort) => infos.every((info) => info.reasoning.efforts.some((candidate) => candidate.id === effort.id)))
      .map((effort) => {
        const named = infos
          .map((info) => info.reasoning.efforts.find((candidate) => candidate.id === effort.id))
          .find((candidate) => isNonEmptyString(candidate?.name))
        return { id: effort.id, name: named?.name ?? effort.name ?? effort.id }
      })
  } else {
    efforts = []
  }
  if (efforts.length === 0) return undefined

  let defaultEffort
  if (model.defaultEffort !== undefined && efforts.some((effort) => effort.id === model.defaultEffort)) {
    defaultEffort = model.defaultEffort
  } else if (infos.length > 0) {
    const commonDefault = infos[0]?.reasoning?.defaultEffort
    if (commonDefault !== undefined && efforts.some((effort) => effort.id === commonDefault) && infos.every((info) => info.reasoning?.defaultEffort === commonDefault)) {
      defaultEffort = commonDefault
    }
  }
  if (defaultEffort === undefined) defaultEffort = efforts[0].id
  return { efforts, defaultEffort }
}

/**
 * Whether one candidate can serve a requested reasoning effort, and which
 * target-side effort id to send.
 * @param {object} model
 * @param {string} member
 * @param {object | undefined} info exact target metadata (undefined = unknown, try anyway)
 * @param {string | undefined} effortId requested unified effort
 * @returns {{ ok: boolean, effort?: string }}
 */
export function effortSupport(model, member, info, effortId) {
  if (effortId === undefined || effortId === null || effortId === '') return { ok: true }
  if (info === undefined) return { ok: true, effort: String(effortId) }
  if (info.reasoning === undefined) return { ok: false }
  if (info.reasoning.efforts.some((effort) => effort.id === effortId)) return { ok: true, effort: String(effortId) }
  const mapped = model.effortMap?.[member]?.[effortId]
  if (isNonEmptyString(mapped)) return { ok: true, effort: mapped }
  return { ok: false }
}

/** @param {Array<object>} messages */
export function messagesHaveImage(messages) {
  if (!Array.isArray(messages)) return false
  for (const message of messages) {
    const content = message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) if (block?.type === 'image') return true
  }
  return false
}

const PROVIDER_COOLDOWN_CODES = new Set([
  'AUTH',
  'MISSING_CREDENTIAL',
  'INVALID_CREDENTIAL',
  'QUOTA',
  'ACCOUNT_QUOTA',
  'NO_ADAPTER',
])

const MODEL_COOLDOWN_CODES = new Set(['RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT', 'EMPTY_RESPONSE'])

const NO_FALLBACK_CODES = new Set(['ABORTED', 'IMAGE_OFFLOAD_REQUIRED'])

const REQUEST_CODES = new Set([
  'INVALID_REQUEST',
  'UNSUPPORTED_OPTION',
  'UNSUPPORTED_CONTENT',
  'UNSUPPORTED_REASONING_EFFORT',
  'INVALID_PREPARED_CALL',
  'CONTEXT_WINDOW_EXCEEDED',
])

/**
 * Classify one terminal model failure.
 * @param {string} code
 * @returns {{ fallback: boolean, cooldown: 'provider' | 'model' | null }}
 */
export function classifyFailure(code) {
  if (NO_FALLBACK_CODES.has(code)) return { fallback: false, cooldown: null }
  if (PROVIDER_COOLDOWN_CODES.has(code)) return { fallback: true, cooldown: 'provider' }
  if (MODEL_COOLDOWN_CODES.has(code)) return { fallback: true, cooldown: 'model' }
  if (REQUEST_CODES.has(code)) return { fallback: true, cooldown: null }
  return { fallback: true, cooldown: null }
}

/**
 * Cooldown duration in milliseconds for one failure, or 0.
 * @param {string} code
 * @param {object | undefined} failure
 * @param {object} cooldown resolved pool cooldown table
 */
export function cooldownMs(code, failure, cooldown = DEFAULT_COOLDOWNS) {
  const table = { ...DEFAULT_COOLDOWNS, ...(cooldown ?? {}) }
  const cap = (value) => Math.min(Math.max(value, 1000), table.maxMs)
  switch (code) {
    case 'AUTH':
    case 'MISSING_CREDENTIAL':
    case 'INVALID_CREDENTIAL':
      return cap(table.authMs)
    case 'QUOTA':
    case 'ACCOUNT_QUOTA':
      return cap(table.quotaMs)
    case 'RATE_LIMIT': {
      const retryAfter = failure?.providerRetryAfterMs
      if (Number.isFinite(retryAfter) && retryAfter > 0) return cap(retryAfter)
      return cap(table.rateLimitMs)
    }
    case 'SERVER':
      return cap(table.serverMs)
    case 'TIMEOUT':
      return cap(table.timeoutMs)
    case 'TRANSPORT':
      return cap(table.transportMs)
    case 'EMPTY_RESPONSE':
      return cap(table.emptyMs)
    case 'NO_ADAPTER':
      return cap(table.authMs)
    default:
      return 0
  }
}

/**
 * Aggregate every candidate failure into one terminal failure that explains the
 * attempt. A transient code is preferred so dsh-llm-retry can still retry the
 * step; request-specific codes win because they describe the actual request.
 * @param {string} poolId
 * @param {string} modelId
 * @param {Array<{ member: string, targetModel: string, failure: object }>} failures
 */
export function aggregateFailures(poolId, modelId, failures) {
  if (failures.length === 0) {
    return {
      code: 'NO_CANDIDATES',
      message: `统一服务商 "${poolId}" 模型 "${modelId}" 没有可尝试的候选渠道`,
    }
  }
  const last = failures[failures.length - 1].failure
  const request = failures.findLast((entry) => REQUEST_CODES.has(entry.failure?.code))
  const transient = failures.findLast((entry) => MODEL_COOLDOWN_CODES.has(entry.failure?.code))
  const chosen = request?.failure ?? transient?.failure ?? last
  const detail = failures
    .map((entry) => {
      const code = isNonEmptyString(entry.failure?.code) ? entry.failure.code : 'UNKNOWN'
      const status = Number.isInteger(entry.failure?.status) ? ` ${entry.failure.status}` : ''
      const message = isNonEmptyString(entry.failure?.message) ? entry.failure.message : '未知失败'
      const clipped = message.length > 240 ? `${message.slice(0, 239)}…` : message
      return `${entry.member}→${entry.targetModel}(${code}${status}): ${clipped}`
    })
    .join('；')
  return {
    code: chosen?.code ?? 'UNKNOWN',
    message: `统一服务商 "${poolId}" 模型 "${modelId}" 的 ${failures.length} 个候选全部失败：${detail}`,
    ...(Number.isInteger(chosen?.status) ? { status: chosen.status } : {}),
    ...(Number.isFinite(chosen?.providerRetryAfterMs) && chosen.providerRetryAfterMs > 0
      ? { providerRetryAfterMs: chosen.providerRetryAfterMs }
      : {}),
  }
}

/** Build one terminal error finish chunk. */
export function failureChunk(failure) {
  return {
    type: 'finish',
    reason: {
      kind: 'error',
      failure: {
        message: failure.message,
        code: failure.code,
        ...(failure.status === undefined ? {} : { status: failure.status }),
        ...(failure.providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs: failure.providerRetryAfterMs }),
      },
    },
  }
}

/** Build one terminal aborted finish chunk. */
export function abortedChunk(failure) {
  return {
    type: 'finish',
    reason: {
      kind: 'aborted',
      failure: {
        message: failure?.message ?? 'request aborted',
        code: failure?.code ?? 'ABORTED',
        ...(Number.isInteger(failure?.status) ? { status: failure.status } : {}),
      },
    },
  }
}

/**
 * Whether a finish chunk represents an empty successful response.
 * @param {object} finish
 * @param {boolean} contentSeen
 */
export function isEmptyResponse(finish, contentSeen) {
  if (contentSeen) return false
  const kind = finish?.reason?.kind
  return kind === 'stop' || kind === 'max-tokens' || kind === 'tool-calls'
}

/** @param {object} finish */
export function finishFailure(finish) {
  const reason = finish?.reason
  if (reason?.kind === 'error' || reason?.kind === 'aborted') {
    return {
      kind: reason.kind,
      failure: {
        message: isNonEmptyString(reason.failure?.message) ? reason.failure.message : '未知的提供方失败',
        code: isNonEmptyString(reason.failure?.code) ? reason.failure.code : 'UNKNOWN',
        ...(Number.isInteger(reason.failure?.status) ? { status: reason.failure.status } : {}),
        ...(Number.isFinite(reason.failure?.providerRetryAfterMs) ? { providerRetryAfterMs: reason.failure.providerRetryAfterMs } : {}),
      },
    }
  }
  return undefined
}

/** @param {unknown} code */
export function isRetryableFailureCode(code, policy) {
  if (policy?.mode === 'always') return true
  return Array.isArray(policy?.retryableCodes) && policy.retryableCodes.includes(code)
}

/**
 * Walk candidate diagnostics into user-facing strings for the status page.
 * @param {object[]} diagnostics
 */
export function diagnosticMessages(diagnostics) {
  return diagnostics.map((diagnostic) => `${diagnostic.level === 'error' ? '错误' : '警告'}：${diagnostic.message}`)
}
