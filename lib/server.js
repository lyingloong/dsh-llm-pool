/**
 * Authenticated HTTP surface for the Models-settings panel:
 *   GET  /llm-pool/status  — config, live pools, route health, recent attempts
 *   POST /llm-pool/save    — validate and persist the pool configuration
 *   POST /llm-pool/test    — one real streaming test through a unified model
 *
 * Requests use the same trust boundary as dsh-model-tester: the connection
 * service's requestRejection gate.
 */

import { randomUUID } from 'node:crypto'

import {
  PLUGIN_VERSION,
  normalizeConfig,
  testSessionId,
} from './pool.js'

const STATUS_ROUTE = '/llm-pool/status'
const SAVE_ROUTE = '/llm-pool/save'
const TEST_ROUTE = '/llm-pool/test'
const MAX_BODY_BYTES = 2 * 1024 * 1024
const DEFAULT_TEST_PROMPT = '请只回复 ok'
const DEFAULT_TEST_TIMEOUT_MS = 30_000

function errorText(error) {
  if (error !== null && typeof error === 'object' && typeof error.message === 'string') return error.message
  return String(error)
}

function sendJson(res, status, value) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(value))
}

function readBoundedBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function clampTimeout(value) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_TEST_TIMEOUT_MS
  return Math.min(Math.max(numeric, 5_000), 120_000)
}

function poolCollision(config, llm) {
  const current = new Set(config.pools.map((pool) => pool.id))
  let registered = []
  try {
    const providers = llm.listProviders?.()
    if (Array.isArray(providers)) registered = providers.map((provider) => provider?.id).filter((id) => typeof id === 'string')
  } catch {
    return []
  }
  return registered.filter((id) => !current.has(id))
}

/**
 * @param {{ config: object, manager: object, llm: object, configEditor?: object, logger?: object }} options
 */
export function createPoolServer(options) {
  const { config, manager, llm, configEditor, logger } = options
  const state = { lastSaveError: null }
  let catalogCache = { at: 0, value: null }

  const ourEntry = () => {
    if (configEditor === undefined) return undefined
    try {
      const entries = configEditor.entries()
      if (!Array.isArray(entries)) return undefined
      return entries.find(
        (entry) => entry?.options?.id === 'llm-pool' || entry?.options?.name === 'dsh-llm-pool',
      )
    } catch {
      return undefined
    }
  }

  async function catalog() {
    const now = Date.now()
    if (catalogCache.value !== null && now - catalogCache.at < 2_000) return catalogCache.value
    const poolIds = new Set(config.pools.map((pool) => pool.id))
    let providers = []
    try {
      const listed = llm.listProviders?.()
      if (Array.isArray(listed)) providers = listed.filter((provider) => !poolIds.has(provider.id))
    } catch (error) {
      logger?.warn?.(`llm-pool: listProviders failed: ${errorText(error)}`)
    }
    const rows = await Promise.all(
      providers.map(async (provider) => {
        try {
          const models = await llm.listModels(provider.id)
          return {
            id: provider.id,
            name: provider.name ?? provider.id,
            models: Array.isArray(models)
              ? models.map((model) => ({ id: model.id, name: model.name ?? model.id }))
              : [],
            error: null,
          }
        } catch (error) {
          return {
            id: provider.id,
            name: provider.name ?? provider.id,
            models: [],
            error: errorText(error),
          }
        }
      }),
    )
    catalogCache = { at: now, value: rows }
    return rows
  }

  function liveDiagnostics() {
    const diagnostics = [...(config.diagnostics ?? [])]
    const poolIds = new Set(config.pools.map((pool) => pool.id))
    let registered = new Set()
    try {
      const providers = llm.listProviders?.()
      if (Array.isArray(providers)) registered = new Set(providers.map((provider) => provider.id))
    } catch {
      // listProviders is already reported by catalog()
    }
    for (const pool of config.pools) {
      if (!registered.has(pool.id)) {
        diagnostics.push({
          level: 'error',
          pool: pool.id,
          message: `统一服务商 "${pool.id}" 当前没有注册（可能是路由名冲突或插件未加载）`,
        })
      }
      for (const member of pool.members) {
        if (poolIds.has(member)) continue
        if (!registered.has(member)) {
          diagnostics.push({
            level: 'warn',
            pool: pool.id,
            message: `成员渠道 "${member}" 当前未注册，相关请求会跳过它`,
          })
        }
      }
    }
    if (state.lastSaveError !== null) {
      diagnostics.push({ level: 'error', message: `上次保存失败：${state.lastSaveError}` })
    }
    return diagnostics
  }

  async function statusValue() {
    const status = manager.status()
    const entry = ourEntry()
    const availableProviders = await catalog()
    return {
      version: PLUGIN_VERSION,
      entryId: entry?.options?.id ?? null,
      writable: entry !== undefined,
      config: {
        providers: cloneJson(config.providers),
        retryPolicy: cloneJson(config.retryPolicy),
      },
      diagnostics: liveDiagnostics(),
      availableProviders,
      pools: status.pools,
      recent: status.recent,
    }
  }

  async function handleStatus(req, res, connection) {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { code: 'unauthorized', message: 'unauthorized' })
    if (req.method !== 'GET') return sendJson(res, 405, { code: 'method-not-allowed', message: 'GET only' })
    try {
      sendJson(res, 200, await statusValue())
    } catch (error) {
      sendJson(res, 500, { code: 'status-failed', message: errorText(error) })
    }
  }

  async function handleSave(req, res, connection) {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { code: 'unauthorized', message: 'unauthorized' })
    if (req.method !== 'POST') return sendJson(res, 405, { code: 'method-not-allowed', message: 'POST only' })
    const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
    if (essence !== 'application/json') {
      return sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
    }
    let body
    try {
      body = JSON.parse(await readBoundedBody(req))
    } catch (error) {
      return sendJson(res, 400, { code: 'bad-request', message: errorText(error) })
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(res, 400, { code: 'bad-request', message: 'body must be an object' })
    }
    const bodyProviders = body.providers
    if (bodyProviders === null || typeof bodyProviders !== 'object' || Array.isArray(bodyProviders)) {
      return sendJson(res, 400, { code: 'bad-request', message: 'body.providers must be an object' })
    }
    const bodyRetryPolicy = body.retryPolicy === undefined ? undefined : body.retryPolicy
    const candidate = normalizeConfig({ providers: bodyProviders, retryPolicy: bodyRetryPolicy })
    const errors = candidate.diagnostics.filter((diagnostic) => diagnostic.level === 'error')
    if (errors.length > 0) {
      return sendJson(res, 400, {
        code: 'invalid-config',
        message: '配置未通过校验',
        diagnostics: candidate.diagnostics,
      })
    }
    if (configEditor === undefined) {
      return sendJson(res, 501, { code: 'not-writable', message: '当前部署没有 configEditor，无法从面板保存；请直接编辑 cordis.patch.yml' })
    }
    const entry = ourEntry()
    if (entry === undefined) {
      return sendJson(res, 409, { code: 'entry-not-found', message: '找不到 llm-pool 的 profile 配置条目，无法保存' })
    }
    const collisions = poolCollision(config, llm)
    for (const id of Object.keys(bodyProviders)) {
      if (collisions.includes(id)) {
        return sendJson(res, 400, {
          code: 'route-collision',
          message: `统一服务商 id "${id}" 与已存在的 provider 路由重名，请换一个名字`,
        })
      }
    }

    const nextConfig = {
      ...(entry.options.config ?? {}),
      providers: cloneJson(bodyProviders),
    }
    if (bodyRetryPolicy === undefined) delete nextConfig.retryPolicy
    else nextConfig.retryPolicy = cloneJson(bodyRetryPolicy)

    state.lastSaveError = null
    sendJson(res, 202, {
      ok: true,
      pending: true,
      diagnostics: candidate.diagnostics,
      providers: Object.keys(candidate.providers),
    })
    Promise.resolve()
      .then(() =>
        configEditor.edit(entry, () => nextConfig),
      )
      .catch((error) => {
        state.lastSaveError = errorText(error)
        logger?.warn?.(`llm-pool: saving configuration failed: ${errorText(error)}`)
      })
  }

  async function handleTest(req, res, connection) {
    const rejection = connection.requestRejection(req)
    if (rejection !== undefined) return sendJson(res, rejection, { code: 'unauthorized', message: 'unauthorized' })
    if (req.method !== 'POST') return sendJson(res, 405, { code: 'method-not-allowed', message: 'POST only' })
    const essence = String(req.headers['content-type']).split(';', 1)[0]?.trim().toLowerCase()
    if (essence !== 'application/json') {
      return sendJson(res, 415, { code: 'unsupported-media-type', message: 'content-type must be application/json' })
    }
    let body
    try {
      body = JSON.parse(await readBoundedBody(req))
    } catch (error) {
      return sendJson(res, 400, { code: 'bad-request', message: errorText(error) })
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(res, 400, { code: 'bad-request', message: 'body must be an object' })
    }
    const provider = typeof body.provider === 'string' ? body.provider : ''
    const model = typeof body.model === 'string' ? body.model : ''
    const member = typeof body.member === 'string' && body.member.length > 0 ? body.member : undefined
    const prompt = typeof body.prompt === 'string' && body.prompt.trim().length > 0 ? body.prompt.slice(0, 2000) : DEFAULT_TEST_PROMPT
    const timeoutMs = clampTimeout(body.timeoutMs)
    const pool = config.pools.find((candidate) => candidate.id === provider)
    if (pool === undefined) {
      return sendJson(res, 400, { code: 'unknown-provider', message: `unknown unified provider "${provider}"` })
    }
    const unifiedModel = pool.models.find((candidate) => candidate.id === model)
    if (unifiedModel === undefined) {
      return sendJson(res, 400, { code: 'unknown-model', message: `unknown unified model "${model}"` })
    }
    if (member !== undefined && !pool.members.includes(member)) {
      return sendJson(res, 400, { code: 'unknown-member', message: `"${member}" is not a member of "${provider}"` })
    }

    const sessionId = testSessionId(member)
    const startedAt = Date.now()
    let firstTokenAt = null
    let finish = null
    let usage = null
    let thrown = null
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error('测试超时')), timeoutMs)
    try {
      const stream = llm.stream({
        provider,
        model,
        sessionId,
        messages: [{
          id: randomUUID(),
          role: 'user',
          content: [{ type: 'text', text: prompt }],
          source: { kind: 'user' },
        }],
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        if (chunk === null || typeof chunk !== 'object') continue
        if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
          if (firstTokenAt === null) firstTokenAt = Date.now()
        } else if (chunk.type === 'usage') {
          usage = chunk.usage ?? null
        } else if (chunk.type === 'finish') {
          finish = chunk
        }
      }
    } catch (error) {
      thrown = error
    } finally {
      clearTimeout(timer)
    }
    const elapsedMs = Date.now() - startedAt
    if (thrown !== null) {
      return sendJson(res, 200, {
        ok: false,
        provider,
        model,
        member: null,
        failure: { code: 'TEST_THROWN', message: errorText(thrown) },
        ttftMs: firstTokenAt === null ? null : firstTokenAt - startedAt,
        elapsedMs,
        attempts: manager.recentForSession(sessionId),
      })
    }
    const attempts = manager.recentForSession(sessionId)
    const success = attempts.findLast((attempt) => attempt.outcome === 'success')
    const failure = finish?.reason?.kind === 'error' || finish?.reason?.kind === 'aborted'
      ? {
          code: finish.reason.failure?.code ?? 'UNKNOWN',
          message: finish.reason.failure?.message ?? '未知失败',
          status: finish.reason.failure?.status ?? null,
        }
      : null
    const ok = finish !== null && (finish.reason?.kind === 'stop' || finish.reason?.kind === 'max-tokens' || finish.reason?.kind === 'tool-calls')
    return sendJson(res, 200, {
      ok,
      provider,
      model,
      member: success?.member ?? attempts.findLast((attempt) => attempt.outcome === 'failure')?.member ?? null,
      targetModel: success?.targetModel ?? attempts.findLast((attempt) => attempt.outcome === 'failure')?.targetModel ?? null,
      failure: failure ?? (ok ? null : { code: 'NO_FINISH', message: '模型流未返回结束原因' }),
      ttftMs: firstTokenAt === null ? null : firstTokenAt - startedAt,
      elapsedMs,
      outputTokens: usage?.outputTokens ?? null,
      attempts,
    })
  }

  function register(webServer, connection) {
    const disposers = []
    const routes = [
      [STATUS_ROUTE, (req, res) => handleStatus(req, res, connection)],
      [SAVE_ROUTE, (req, res) => handleSave(req, res, connection)],
      [TEST_ROUTE, (req, res) => handleTest(req, res, connection)],
    ]
    for (const [path, handler] of routes) {
      try {
        disposers.push(webServer.register({ kind: 'exact', path, handler }))
      } catch (error) {
        logger?.warn?.(`llm-pool: registering ${path} failed: ${errorText(error)}`)
      }
    }
    return () => {
      for (const dispose of disposers) {
        try {
          dispose()
        } catch {
          // best effort
        }
      }
    }
  }

  return { register, statusValue, ourEntry, state }
}

/** Exported for tests: a tiny response collector. */
export function createResponseRecorder() {
  const state = { status: 0, headers: {}, body: '', ended: false }
  return {
    state,
    set statusCode(value) {
      state.status = value
    },
    get statusCode() {
      return state.status
    },
    setHeader(name, value) {
      state.headers[String(name).toLowerCase()] = value
    },
    end(value) {
      state.ended = true
      state.body = value === undefined ? '' : String(value)
    },
  }
}
