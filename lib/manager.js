/**
 * Live pool runtime: session-sticky assignment, global balancing, health
 * cooldowns, attempt recording, and the LLM adapter that dispatches each
 * unified-model request to one real provider route.
 */

import {
  DEFAULT_CONTEXT_WINDOW,
  aggregateFailures,
  classifyFailure,
  cooldownMs,
  effortSupport,
  failureChunk,
  finishFailure,
  findPoolModel,
  isEmptyResponse,
  isTestSession,
  mergeModelInfo,
  messagesHaveImage,
  modelTargets,
  scopeKey,
  testMemberFromSession,
} from './pool.js'

const TEXT = '\u0000'
const ANONYMOUS_SCOPE = '__anonymous__'

function routeKey(member, targetModel) {
  return `${member}${TEXT}${targetModel}`
}

function providerCooldownKey(member) {
  return `${member}${TEXT}*`
}

function safeClone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function truncate(value, max = 300) {
  const text = typeof value === 'string' ? value : String(value)
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function isContentChunk(chunk) {
  return (
    chunk.type === 'block-start' ||
    chunk.type === 'block-end' ||
    chunk.type === 'text-delta' ||
    chunk.type === 'reasoning-delta' ||
    chunk.type === 'tool-call-delta'
  )
}

function isAbortReason(reason) {
  if (reason === undefined || reason === null) return false
  if (typeof reason === 'string') return true
  if (typeof reason === 'object' && typeof reason.message === 'string') return true
  return false
}

function abortFailure(signal) {
  const reason = signal?.reason
  if (reason !== undefined && reason !== null) {
    if (typeof reason === 'string') return { message: reason, code: 'ABORTED' }
    if (typeof reason.message === 'string' && reason.message.length > 0) {
      return { message: reason.message, code: typeof reason.code === 'string' ? reason.code : 'ABORTED' }
    }
  }
  return { message: 'request aborted', code: 'ABORTED' }
}

export class PoolManager {
  /**
   * @param {{ llm: object, config: object, logger?: object, now?: () => number }} options
   */
  constructor({ llm, config, logger, now = () => Date.now() }) {
    this.llm = llm
    this.config = config
    this.logger = logger
    this.now = now
    this.poolById = new Map(config.pools.map((pool) => [pool.id, pool]))
    this.defaults = { contextWindow: DEFAULT_CONTEXT_WINDOW }
    this.providerCache = { at: 0, ids: new Set() }
    this.targetInfo = new Map()
    this.merged = new Map()
    this.cooldowns = new Map()
    this.routeStats = new Map()
    this.recent = []
    this.preferred = new Map()
    this.preferredCounts = new Map()
    this.overrides = new Map()
    this.overrideCounts = new Map()
    this.sessionIndex = new Map()
    this.balanceCursors = new Map()
    this.rrCursors = new Map()
    this.testCursors = new Map()
  }

  /** Refresh after a foreign adapter registration change. */
  invalidateRoutes() {
    this.providerCache = { at: 0, ids: new Set() }
    this.targetInfo.clear()
    this.merged.clear()
  }

  registeredProviderIds() {
    const now = this.now()
    if (now - this.providerCache.at < 1000) return this.providerCache.ids
    let ids = new Set()
    try {
      const providers = this.llm.listProviders?.()
      if (Array.isArray(providers)) ids = new Set(providers.map((provider) => provider?.id).filter((id) => typeof id === 'string'))
    } catch (error) {
      this.logger?.warn?.(`llm-pool: listProviders failed: ${String(error)}`)
    }
    this.providerCache = { at: now, ids }
    return ids
  }

  isProviderRegistered(id) {
    return this.registeredProviderIds().has(id)
  }

  pool(id) {
    return this.poolById.get(id)
  }

  /**
   * Resolve one target route's metadata, cached briefly. Unknown routes are
   * retried after a short negative TTL; a permanent catalog failure is reported
   * as `{ error }` instead of throwing, so metadata composition stays fail-soft.
   */
  async resolveTargetInfo(member, targetModel, signal) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('aborted')
    const key = routeKey(member, targetModel)
    const now = this.now()
    const cached = this.targetInfo.get(key)
    if (cached !== undefined) {
      const ttl = cached.error === undefined ? 60_000 : 10_000
      if (now - cached.at < ttl) {
        if (cached.error === undefined) return { info: cached.info }
        return { error: cached.error }
      }
    }
    try {
      const info = await this.llm.resolveModelInfo(member, targetModel, signal)
      if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('aborted')
      this.targetInfo.set(key, { at: now, info })
      return { info }
    } catch (error) {
      if (signal?.aborted) throw error
      this.targetInfo.set(key, { at: now, error })
      return { error }
    }
  }

  /**
   * Compose the unified model info. This is the exact metadata the model picker
   * and prepareCall see, so it must remain valid when no target is reachable.
   */
  async resolveModel(poolId, modelId, signal) {
    const now = this.now()
    const key = `${poolId}${TEXT}${modelId}`
    const cached = this.merged.get(key)
    if (cached !== undefined && now - cached.at < 30_000) return safeClone(cached.info)
    const pool = this.poolById.get(poolId)
    const model = pool === undefined ? undefined : findPoolModel(pool, modelId)
    if (pool === undefined || model === undefined) {
      const info = {
        provider: poolId,
        id: modelId,
        name: modelId,
        context: { contextWindow: this.defaults.contextWindow },
        inputModalities: ['text'],
      }
      this.merged.set(key, { at: now, info })
      return safeClone(info)
    }
    const targets = await Promise.all(
      modelTargets(model).map(async (target) => {
        if (!this.isProviderRegistered(target.member)) {
          return { member: target.member, targetModel: target.model, error: new Error('provider route is not registered') }
        }
        const resolved = await this.resolveTargetInfo(target.member, target.model, signal)
        return { member: target.member, targetModel: target.model, ...resolved }
      }),
    )
    const info = mergeModelInfo(pool, model, targets, this.defaults)
    this.merged.set(key, { at: now, info })
    return safeClone(info)
  }

  listModels(poolId) {
    const pool = this.poolById.get(poolId)
    if (pool === undefined) return []
    return pool.models.map((model) => ({
      provider: poolId,
      id: model.id,
      name: model.name,
      description: `统一模型 · ${model.targets.length} 个渠道`,
    }))
  }

  /**
   * Build the route-eligible candidate list for one request.
   * @returns {Promise<{ candidates: object[], skipped: object[], image: boolean }>}
   */
  async eligibleCandidates(pool, model, options) {
    const image = messagesHaveImage(options.messages)
    const effort = options.reasoningEffort
    const registered = this.registeredProviderIds()
    const results = await Promise.all(
      modelTargets(model).map(async (target) => {
        if (!registered.has(target.member)) {
          return { skipped: { member: target.member, reason: 'provider 路由未注册' } }
        }
        const resolved = await this.resolveTargetInfo(target.member, target.model, options.signal)
        const info = resolved.info
        if (image && info !== undefined) {
          const modalities = Array.isArray(info.inputModalities) ? info.inputModalities : []
          if (!modalities.includes('image')) return { skipped: { member: target.member, reason: '不支持图片输入' } }
        }
        const support = effortSupport(model, target.member, info, effort)
        if (!support.ok) {
          return { skipped: { member: target.member, reason: `不支持推理档位 "${String(effort)}"` } }
        }
        return {
          candidate: {
            member: target.member,
            targetModel: target.model,
            info,
            infoError: resolved.error,
            effort: support.effort,
          },
        }
      }),
    )
    const candidates = results.filter((entry) => entry.candidate !== undefined).map((entry) => entry.candidate)
    const skipped = results.filter((entry) => entry.skipped !== undefined).map((entry) => entry.skipped)
    return { candidates, skipped, image }
  }

  /**
   * Decide the attempt order. Sticky mode assigns a member per Session+pool
   * (and per unified model only when the Session's member cannot serve that
   * model); new Sessions are balanced globally by live assignment count.
   */
  planOrder(pool, model, options, candidates) {
    if (candidates.length === 0) throw new Error('planOrder requires candidates')
    if (isTestSession(options.sessionId)) return this.planTest(pool, model, options, candidates)
    if (pool.strategy === 'round-robin') return this.planRoundRobin(pool, model, candidates)
    if (pool.strategy === 'failover') {
      const order = this.orderCandidates(candidates, candidates[0].member, false)
      return { order, kind: 'failover', stickyMember: undefined, scope: null, assignmentKind: null }
    }
    return this.planSticky(pool, model, options, candidates)
  }

  planTest(pool, model, options, candidates) {
    const requested = testMemberFromSession(options.sessionId)
    const hasRequested = requested !== undefined && candidates.some((candidate) => candidate.member === requested)
    let start
    if (hasRequested) {
      start = requested
    } else {
      const cursorKey = `${pool.id}${TEXT}${model.id}`
      const cursor = this.testCursors.get(cursorKey) ?? 0
      this.testCursors.set(cursorKey, cursor + 1)
      start = candidates[cursor % candidates.length].member
    }
    return {
      order: this.orderCandidates(candidates, start, hasRequested),
      kind: 'test',
      stickyMember: start,
      scope: null,
      assignmentKind: null,
    }
  }

  planRoundRobin(pool, model, candidates) {
    const cursorKey = `${pool.id}${TEXT}${model.id}`
    const cursor = this.rrCursors.get(cursorKey) ?? 0
    this.rrCursors.set(cursorKey, cursor + 1)
    const start = candidates[cursor % candidates.length].member
    return {
      order: this.orderCandidates(candidates, start, false),
      kind: 'round-robin',
      stickyMember: start,
      scope: null,
      assignmentKind: null,
    }
  }

  planSticky(pool, model, options, candidates) {
    const scope = scopeKey(options.sessionId) ?? ANONYMOUS_SCOPE
    const preferredKey = `${scope}${TEXT}${pool.id}`
    let preferredMember = this.preferred.get(preferredKey)

    if (preferredMember !== undefined && (!pool.members.includes(preferredMember) || !this.isProviderRegistered(preferredMember))) {
      this.clearPreferred(scope, pool)
      preferredMember = undefined
    }

    let kind
    let stickyMember
    let assignmentKind
    if (preferredMember === undefined) {
      const chosen = this.chooseBalanced(pool, model, candidates, this.preferredCounts, (candidate) => `${pool.id}${TEXT}${candidate.member}`, `${pool.id}`)
      this.setPreferred(scope, pool, chosen.member)
      preferredMember = chosen.member
      stickyMember = chosen.member
      kind = 'new'
      assignmentKind = 'preferred'
    } else if (candidates.some((candidate) => candidate.member === preferredMember)) {
      stickyMember = preferredMember
      kind = 'preferred'
      assignmentKind = 'preferred'
    } else {
      const overrideKey = `${scope}${TEXT}${pool.id}${TEXT}${model.id}`
      let overrideMember = this.overrides.get(overrideKey)
      if (overrideMember !== undefined && !candidates.some((candidate) => candidate.member === overrideMember)) {
        this.clearOverride(scope, pool, model)
        overrideMember = undefined
      }
      if (overrideMember === undefined) {
        const chosen = this.chooseBalanced(
          pool,
          model,
          candidates,
          this.overrideCounts,
          (candidate) => `${pool.id}${TEXT}${model.id}${TEXT}${candidate.member}`,
          `${pool.id}${TEXT}${model.id}`,
        )
        this.setOverride(scope, pool, model, chosen.member)
        overrideMember = chosen.member
      }
      stickyMember = overrideMember
      kind = 'override'
      assignmentKind = 'override'
    }

    return {
      order: this.orderCandidates(candidates, stickyMember, false),
      kind,
      stickyMember,
      scope,
      assignmentKind,
      poolId: pool.id,
      modelId: model.id,
    }
  }

  /**
   * Order candidates so the desired member is first when it can be tried, then
   * the rest cyclically. Members in cooldown are held back, and only included
   * when every candidate is cooling (fail-open, earliest recovery first).
   */
  orderCandidates(candidates, startMember, ignoreCooldown) {
    const index = startMember === undefined ? -1 : candidates.findIndex((candidate) => candidate.member === startMember)
    const rotated = index >= 0 ? [...candidates.slice(index), ...candidates.slice(0, index)] : [...candidates]
    if (ignoreCooldown) return rotated
    const now = this.now()
    const ready = []
    const cooling = []
    for (const candidate of rotated) {
      const info = this.coolingInfo(candidate)
      if (info === undefined) ready.push(candidate)
      else cooling.push({ candidate, until: info.until })
    }
    cooling.sort((left, right) => left.until - right.until)
    return [...ready, ...cooling.map((entry) => entry.candidate)]
  }

  chooseBalanced(pool, model, candidates, countsMap, keyOf, cursorKey) {
    const now = this.now()
    const ready = candidates.filter((candidate) => {
      const cooldown = this.cooldowns.get(providerCooldownKey(candidate.member))
      const route = this.cooldowns.get(routeKey(candidate.member, candidate.targetModel))
      return (cooldown === undefined || cooldown.until <= now) && (route === undefined || route.until <= now)
    })
    const choices = ready.length > 0 ? ready : candidates
    const loads = choices.map((candidate) => countsMap.get(keyOf(candidate)) ?? 0)
    const min = Math.min(...loads)
    const tied = choices.filter((_, index) => loads[index] === min)
    const cursor = this.balanceCursors.get(cursorKey) ?? 0
    this.balanceCursors.set(cursorKey, cursor + 1)
    return tied[cursor % tied.length]
  }

  counted(scope) {
    return scope !== ANONYMOUS_SCOPE && scope !== null && scope !== undefined
  }

  adjustCount(map, key, delta) {
    const current = map.get(key) ?? 0
    const next = current + delta
    if (next <= 0) map.delete(key)
    else map.set(key, next)
  }

  remember(scope, type, key) {
    if (!this.counted(scope)) return
    let index = this.sessionIndex.get(scope)
    if (index === undefined) {
      index = { preferred: new Set(), overrides: new Set() }
      this.sessionIndex.set(scope, index)
    }
    index[type].add(key)
  }

  setPreferred(scope, pool, member) {
    const key = `${scope}${TEXT}${pool.id}`
    const previous = this.preferred.get(key)
    if (previous === member) return
    if (previous !== undefined) {
      if (this.counted(scope)) this.adjustCount(this.preferredCounts, `${pool.id}${TEXT}${previous}`, -1)
      const index = this.sessionIndex.get(scope)
      index?.preferred.delete(key)
    }
    this.preferred.set(key, member)
    if (this.counted(scope)) {
      this.adjustCount(this.preferredCounts, `${pool.id}${TEXT}${member}`, 1)
      this.remember(scope, 'preferred', key)
    }
  }

  clearPreferred(scope, pool) {
    const key = `${scope}${TEXT}${pool.id}`
    const previous = this.preferred.get(key)
    if (previous === undefined) return
    this.preferred.delete(key)
    if (this.counted(scope)) {
      this.adjustCount(this.preferredCounts, `${pool.id}${TEXT}${previous}`, -1)
      this.sessionIndex.get(scope)?.preferred.delete(key)
    }
  }

  setOverride(scope, pool, model, member) {
    const key = `${scope}${TEXT}${pool.id}${TEXT}${model.id}`
    const previous = this.overrides.get(key)
    if (previous === member) return
    if (previous !== undefined) {
      if (this.counted(scope)) this.adjustCount(this.overrideCounts, `${pool.id}${TEXT}${model.id}${TEXT}${previous}`, -1)
      this.sessionIndex.get(scope)?.overrides.delete(key)
    }
    this.overrides.set(key, member)
    if (this.counted(scope)) {
      this.adjustCount(this.overrideCounts, `${pool.id}${TEXT}${model.id}${TEXT}${member}`, 1)
      this.remember(scope, 'overrides', key)
    }
  }

  clearOverride(scope, pool, model) {
    const key = `${scope}${TEXT}${pool.id}${TEXT}${model.id}`
    const previous = this.overrides.get(key)
    if (previous === undefined) return
    this.overrides.delete(key)
    if (this.counted(scope)) {
      this.adjustCount(this.overrideCounts, `${pool.id}${TEXT}${model.id}${TEXT}${previous}`, -1)
      this.sessionIndex.get(scope)?.overrides.delete(key)
    }
  }

  /** Release all balancing state owned by one Session. */
  forgetSession(sessionId) {
    const scope = scopeKey(sessionId)
    if (scope === null || scope === ANONYMOUS_SCOPE) return
    const index = this.sessionIndex.get(scope)
    if (index === undefined) return
    for (const key of index.preferred) {
      const member = this.preferred.get(key)
      const poolId = key.slice(scope.length + 1)
      if (member !== undefined && poolId.length > 0) this.adjustCount(this.preferredCounts, `${poolId}${TEXT}${member}`, -1)
      this.preferred.delete(key)
    }
    for (const key of index.overrides) {
      const rest = key.slice(scope.length + 1)
      const split = rest.indexOf(TEXT)
      if (split <= 0) continue
      const poolId = rest.slice(0, split)
      const modelId = rest.slice(split + 1)
      const member = this.overrides.get(key)
      if (member !== undefined && modelId.length > 0) {
        this.adjustCount(this.overrideCounts, `${poolId}${TEXT}${modelId}${TEXT}${member}`, -1)
      }
      this.overrides.delete(key)
    }
    this.sessionIndex.delete(scope)
  }

  /** Whether a route (or its provider) is in cooldown. */
  coolingInfo(candidate) {
    const now = this.now()
    const provider = this.cooldowns.get(providerCooldownKey(candidate.member))
    const model = this.cooldowns.get(routeKey(candidate.member, candidate.targetModel))
    const entries = [provider, model].filter((entry) => entry !== undefined && entry.until > now)
    if (entries.length === 0) return undefined
    return entries.reduce((left, right) => (right.until > left.until ? right : left))
  }

  setCooldown(key, durationMs, failure) {
    if (!(durationMs > 0)) return
    const until = this.now() + durationMs
    const previous = this.cooldowns.get(key)
    if (previous !== undefined && previous.until > until) return
    this.cooldowns.set(key, {
      until,
      code: typeof failure?.code === 'string' ? failure.code : 'UNKNOWN',
      message: truncate(failure?.message ?? ''),
    })
  }

  clearCooldowns(member, targetModel) {
    this.cooldowns.delete(providerCooldownKey(member))
    this.cooldowns.delete(routeKey(member, targetModel))
  }

  recordSuccess(pool, candidate) {
    const key = routeKey(candidate.member, candidate.targetModel)
    const stats = this.routeStats.get(key) ?? { success: 0, failure: 0 }
    stats.success += 1
    stats.lastAt = this.now()
    this.routeStats.set(key, stats)
    this.clearCooldowns(candidate.member, candidate.targetModel)
  }

  recordFailure(pool, candidate, failure) {
    const key = routeKey(candidate.member, candidate.targetModel)
    const stats = this.routeStats.get(key) ?? { success: 0, failure: 0 }
    stats.failure += 1
    stats.lastAt = this.now()
    stats.lastCode = failure?.code
    stats.lastMessage = truncate(failure?.message ?? '')
    this.routeStats.set(key, stats)
    const classification = classifyFailure(failure?.code)
    if (classification.cooldown === null) return
    const duration = cooldownMs(failure.code, failure, pool.cooldown)
    if (!(duration > 0)) return
    const cooldownKey = classification.cooldown === 'provider' ? providerCooldownKey(candidate.member) : key
    this.setCooldown(cooldownKey, duration, failure)
    this.logger?.debug?.(
      `llm-pool: ${pool.id}/${modelLabel(pool, candidate)} cooled down for ${duration}ms after ${failure.code}`,
    )
  }

  pushAttempt(entry) {
    this.recent.push(entry)
    if (this.recent.length > 300) this.recent.splice(0, this.recent.length - 300)
  }

  recentForSession(sessionId, limit = 20) {
    const id = typeof sessionId === 'string' ? sessionId : String(sessionId ?? '')
    return this.recent.filter((entry) => entry.sessionId === id).slice(-limit)
  }

  /** Apply the sticky assignment after a successful fallback. */
  reassignAfterSuccess(plan, candidate) {
    if (plan.assignmentKind === null || plan.scope === null) return
    const pool = this.poolById.get(plan.poolId)
    const model = pool === undefined ? undefined : findPoolModel(pool, plan.modelId)
    if (pool === undefined || model === undefined) return
    if (plan.assignmentKind === 'preferred') {
      if (plan.stickyMember !== candidate.member) this.setPreferred(plan.scope, pool, candidate.member)
    } else if (plan.assignmentKind === 'override') {
      if (plan.stickyMember !== candidate.member) this.setOverride(plan.scope, pool, model, candidate.member)
    }
  }

  /** Complete status projection for the Models panel and diagnostics. */
  status() {
    const now = this.now()
    const pools = this.config.pools.map((pool) => {
      const preferred = pool.members.map((member) => ({
        member,
        sessions: this.preferredCounts.get(`${pool.id}${TEXT}${member}`) ?? 0,
      }))
      const overrides = []
      for (const model of pool.models) {
        for (const member of pool.members) {
          const sessions = this.overrideCounts.get(`${pool.id}${TEXT}${model.id}${TEXT}${member}`) ?? 0
          if (sessions > 0) overrides.push({ model: model.id, member, sessions })
        }
      }
      const routes = []
      for (const model of pool.models) {
        for (const target of model.targets) {
          const key = routeKey(target.member, target.model)
          const stats = this.routeStats.get(key) ?? { success: 0, failure: 0 }
          const providerCool = this.cooldowns.get(providerCooldownKey(target.member))
          const modelCool = this.cooldowns.get(key)
          const cool = [providerCool, modelCool].filter((entry) => entry !== undefined && entry.until > now)
          const cooldown = cool.length === 0 ? undefined : cool.reduce((left, right) => (right.until > left.until ? right : left))
          routes.push({
            model: model.id,
            member: target.member,
            targetModel: target.model,
            success: stats.success,
            failure: stats.failure,
            lastAt: stats.lastAt ?? null,
            lastCode: stats.lastCode ?? null,
            lastMessage: stats.lastMessage ?? null,
            cooldownUntil: cooldown?.until ?? null,
            cooldownCode: cooldown?.code ?? null,
          })
        }
      }
      return {
        id: pool.id,
        displayName: pool.displayName,
        strategy: pool.strategy,
        members: [...pool.members],
        models: pool.models.map((model) => ({
          id: model.id,
          name: model.name,
          targets: Object.fromEntries(model.targets.map((target) => [target.member, target.model])),
        })),
        preferred,
        overrides,
        routes,
      }
    })
    return {
      pools,
      recent: this.recent.slice(-50).map((entry) => ({ ...entry })),
    }
  }
}

function modelLabel(pool, candidate) {
  return `${candidate.member}/${candidate.targetModel}`
}

/**
 * Restore an inner adapter's native replay envelope when this exact message
 * was produced by the same target route. Messages produced by another route are
 * left untouched so dsh-llm strips their replay state at dispatch.
 */
function restoreReplay(messages, candidate, poolId) {
  if (!Array.isArray(messages)) return messages
  let changed = false
  const next = messages.map((message) => {
    if (message?.role !== 'assistant') return message
    const source = message.source
    if (source?.provider !== poolId) return message
    const envelope = source.replayState
    if (envelope === null || typeof envelope !== 'object' || envelope.__llmPool !== 1) return message
    if (envelope.provider !== candidate.member || envelope.model !== candidate.targetModel) return message
    if (envelope.inner === undefined) return message
    changed = true
    return {
      ...message,
      source: {
        kind: 'model',
        provider: candidate.member,
        model: candidate.targetModel,
        replayState: envelope.inner,
      },
    }
  })
  return changed ? next : messages
}

/** Wrap an inner adapter's replay envelope with the concrete route that owns it. */
function wrapReplay(finish, candidate) {
  if (finish.replayState === undefined) return finish
  return {
    ...finish,
    replayState: {
      __llmPool: 1,
      provider: candidate.member,
      model: candidate.targetModel,
      inner: finish.replayState,
    },
  }
}

/** Build the inner request for one real route. */
export function buildInnerOptions(options, candidate, poolId) {
  const next = {
    ...options,
    provider: candidate.member,
    model: candidate.targetModel,
    messages: restoreReplay(options.messages, candidate, poolId),
  }
  if (candidate.effort !== undefined) next.reasoningEffort = candidate.effort
  return next
}

function noCandidateFailure(pool, model, eligible, options) {
  const details = eligible.skipped.map((entry) => `${entry.member}: ${entry.reason}`).join('；')
  const suffix = details.length > 0 ? `（${details}）` : ''
  if (eligible.image) {
    return {
      code: 'NO_IMAGE_CAPABLE_ROUTE',
      message: `统一服务商 "${pool.id}" 模型 "${model.id}" 没有支持图片输入的可用渠道${suffix}`,
    }
  }
  if (options.reasoningEffort !== undefined) {
    return {
      code: 'NO_EFFORT_CAPABLE_ROUTE',
      message: `统一服务商 "${pool.id}" 模型 "${model.id}" 没有支持推理档位 "${String(options.reasoningEffort)}" 的可用渠道${suffix}`,
    }
  }
  return {
    code: 'NO_CANDIDATES',
    message: `统一服务商 "${pool.id}" 模型 "${model.id}" 没有可用候选渠道${suffix}`,
  }
}

/**
 * Build the dsh-llm adapter that owns every configured pool route.
 * @param {{ manager: PoolManager, logger?: object }} options
 */
export function createPoolAdapter({ manager }) {
  const adapter = {
    providerInfo(provider) {
      const pool = manager.pool(provider)
      return { id: provider, name: pool?.displayName ?? provider }
    },

    providerRetryPolicy(_provider) {
      return manager.config.retryPolicy
    },

    imageRequestPricing(_provider, _model) {
      return undefined
    },

    imageRequestTarget(_provider, _model, image) {
      return { width: image.width, height: image.height, maxBytes: image.bytes }
    },

    listModels(provider) {
      return manager.listModels(provider)
    },

    resolveModel(provider, model, signal) {
      return manager.resolveModel(provider, model, signal)
    },

    async prepareCall(provider, model, signal) {
      const info = await manager.resolveModel(provider, model, signal)
      return { model: info, stream: (options) => adapter.stream(options) }
    },

    async *stream(options) {
      const pool = manager.pool(options.provider)
      if (pool === undefined) {
        yield failureChunk({
          code: 'NO_ADAPTER',
          message: `统一服务商 "${options.provider}" 不存在`,
        })
        return
      }
      const model = findPoolModel(pool, options.model)
      if (model === undefined) {
        yield failureChunk({
          code: 'UNKNOWN_MODEL',
          message: `统一服务商 "${pool.id}" 没有模型 "${options.model}"`,
        })
        return
      }
      if (options.signal?.aborted) {
        yield {
          type: 'finish',
          reason: { kind: 'aborted', failure: abortFailure(options.signal) },
        }
        return
      }

      const eligible = await manager.eligibleCandidates(pool, model, options)
      if (eligible.candidates.length === 0) {
        const failure = noCandidateFailure(pool, model, eligible, options)
        manager.pushAttempt({
          at: manager.now(),
          sessionId: String(options.sessionId ?? ''),
          pool: pool.id,
          model: model.id,
          member: '',
          targetModel: '',
          attempt: 0,
          candidates: 0,
          outcome: 'failure',
          code: failure.code,
          status: null,
          latencyMs: 0,
          message: failure.message,
          test: isTestSession(options.sessionId),
        })
        yield failureChunk(failure)
        return
      }

      const plan = manager.planOrder(pool, model, options, eligible.candidates)
      const failures = []

      for (let index = 0; index < plan.order.length; index += 1) {
        const candidate = plan.order[index]
        if (options.signal?.aborted) {
          yield { type: 'finish', reason: { kind: 'aborted', failure: abortFailure(options.signal) } }
          return
        }
        const startedAt = manager.now()
        const innerOptions = buildInnerOptions(options, candidate, pool.id)
        let iterator
        try {
          iterator = manager.llm.stream(innerOptions)[Symbol.asyncIterator]()
        } catch (error) {
          throw error
        }

        let contentSeen = false
        let usage
        let finish
        let thrown
        try {
          for (;;) {
            let next
            try {
              next = await iterator.next()
            } catch (error) {
              thrown = error
              break
            }
            if (next.done === true) break
            const chunk = next.value
            if (chunk === null || typeof chunk !== 'object') continue
            if (chunk.type === 'finish') {
              finish = chunk
              continue
            }
            if (chunk.type === 'usage') {
              usage = chunk
              continue
            }
            if (isContentChunk(chunk)) contentSeen = true
            yield chunk
          }
        } finally {
          if (typeof iterator.return === 'function') {
            try {
              await iterator.return()
            } catch {
              // closing a settled inner stream is best effort
            }
          }
        }

        if (thrown !== undefined) throw thrown

        if (finish === undefined) {
          const failure = { code: 'NO_FINISH', message: '模型流未返回结束原因' }
          failures.push({ member: candidate.member, targetModel: candidate.targetModel, failure })
          manager.recordFailure(pool, candidate, failure)
          manager.pushAttempt({
            at: manager.now(),
            sessionId: String(options.sessionId ?? ''),
            pool: pool.id,
            model: model.id,
            member: candidate.member,
            targetModel: candidate.targetModel,
            attempt: index + 1,
            candidates: plan.order.length,
            outcome: 'failure',
            code: failure.code,
            status: null,
            latencyMs: manager.now() - startedAt,
            message: failure.message,
            test: isTestSession(options.sessionId),
          })
          if (contentSeen) {
            yield failureChunk(failure)
            return
          }
          continue
        }

        const terminal = finishFailure(finish)
        if (terminal !== undefined) {
          if (terminal.kind === 'aborted') {
            yield { type: 'finish', reason: { kind: 'aborted', failure: terminal.failure } }
            return
          }
          const failure = terminal.failure
          failures.push({ member: candidate.member, targetModel: candidate.targetModel, failure })
          manager.recordFailure(pool, candidate, failure)
          manager.pushAttempt({
            at: manager.now(),
            sessionId: String(options.sessionId ?? ''),
            pool: pool.id,
            model: model.id,
            member: candidate.member,
            targetModel: candidate.targetModel,
            attempt: index + 1,
            candidates: plan.order.length,
            outcome: 'failure',
            code: failure.code,
            status: failure.status ?? null,
            latencyMs: manager.now() - startedAt,
            message: failure.message,
            test: isTestSession(options.sessionId),
          })
          const classification = classifyFailure(failure.code)
          if (!classification.fallback || contentSeen) {
            yield failureChunk(failure)
            return
          }
          continue
        }

        if (isEmptyResponse(finish, contentSeen)) {
          const failure = { code: 'EMPTY_RESPONSE', message: '模型返回了空响应' }
          failures.push({ member: candidate.member, targetModel: candidate.targetModel, failure })
          manager.recordFailure(pool, candidate, failure)
          manager.pushAttempt({
            at: manager.now(),
            sessionId: String(options.sessionId ?? ''),
            pool: pool.id,
            model: model.id,
            member: candidate.member,
            targetModel: candidate.targetModel,
            attempt: index + 1,
            candidates: plan.order.length,
            outcome: 'failure',
            code: failure.code,
            status: null,
            latencyMs: manager.now() - startedAt,
            message: failure.message,
            test: isTestSession(options.sessionId),
          })
          continue
        }

        if (usage !== undefined) yield usage
        yield wrapReplay(finish, candidate)
        manager.recordSuccess(pool, candidate)
        manager.pushAttempt({
          at: manager.now(),
          sessionId: String(options.sessionId ?? ''),
          pool: pool.id,
          model: model.id,
          member: candidate.member,
          targetModel: candidate.targetModel,
          attempt: index + 1,
          candidates: plan.order.length,
          outcome: 'success',
          code: null,
          status: null,
          latencyMs: manager.now() - startedAt,
          message: '',
          test: isTestSession(options.sessionId),
        })
        manager.reassignAfterSuccess(plan, candidate)
        return
      }

      const aggregate = aggregateFailures(pool.id, model.id, failures)
      yield failureChunk(aggregate)
    },
  }
  return adapter
}

/** Re-exported for the server's status route. */
export { ANONYMOUS_SCOPE }
