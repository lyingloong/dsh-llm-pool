/**
 * dsh-llm-pool host entry.
 *
 * Registers one virtual LLM provider route per configured pool. Each route owns
 * unified models whose requests are delegated to the real provider routes
 * listed in the pool, with session-sticky global balancing and automatic
 * failover. The same plugin serves the Models-settings panel over authenticated
 * HTTP routes.
 */

import { normalizeConfig } from './lib/pool.js'
import { PoolManager, createPoolAdapter } from './lib/manager.js'
import { createPoolServer } from './lib/server.js'

export const name = 'llm-pool'
export const inject = ['llm']

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {unknown} config
 */
export function apply(ctx, config = {}) {
  const logger = ctx.logger
  const normalized = normalizeConfig(config)
  const manager = new PoolManager({ llm: ctx.llm, config: normalized, logger })
  const adapter = createPoolAdapter({ manager })

  let providerIds = []
  try {
    const existing = new Set(
      (Array.isArray(ctx.llm.listProviders()) ? ctx.llm.listProviders() : []).map((provider) => provider.id),
    )
    providerIds = normalized.pools.filter((pool) => !existing.has(pool.id)).map((pool) => pool.id)
    for (const pool of normalized.pools) {
      if (existing.has(pool.id)) {
        normalized.diagnostics.push({
          level: 'error',
          pool: pool.id,
          message: `统一服务商 id "${pool.id}" 与已存在的 provider 路由重名，未注册该池`,
        })
      }
    }
    if (providerIds.length > 0) {
      ctx.effect(() => ctx.llm.registerAdapter(providerIds, adapter), 'llm-pool: provider routes')
      logger?.info?.(`llm-pool: registered ${providerIds.length} unified provider(s): ${providerIds.join(', ')}`)
    } else {
      logger?.info?.('llm-pool: no unified provider routes to register')
    }
  } catch (error) {
    normalized.diagnostics.push({
      level: 'error',
      message: `注册统一服务商失败：${error instanceof Error ? error.message : String(error)}`,
    })
    logger?.error?.(`llm-pool: provider registration failed: ${String(error)}`)
  }

  const disposeAdaptersUpdated = ctx.on('llm/adapters-updated', () => {
    manager.invalidateRoutes()
  })
  const disposeSessionDisposed = ctx.on('session/disposed', (session) => {
    if (session !== null && session !== undefined && typeof session.id === 'string') manager.forgetSession(session.id)
  })
  ctx.effect(
    () => () => {
      disposeAdaptersUpdated()
      disposeSessionDisposed()
    },
    'llm-pool: runtime listeners',
  )

  const webServer = ctx.get('webServer')
  const connection = ctx.get('connection')
  const configEditor = ctx.get('configEditor')
  if (webServer !== undefined && connection !== undefined) {
    const server = createPoolServer({
      config: normalized,
      manager,
      llm: ctx.llm,
      configEditor,
      logger,
    })
    ctx.effect(() => server.register(webServer, connection), 'llm-pool: HTTP routes')
    logger?.info?.('llm-pool: Models panel API registered at /llm-pool/*')
  } else {
    logger?.info?.('llm-pool: no Web server/connection service; panel API disabled')
  }

  // A plugin body may return one disposer. Return a callable carrier instead
  // of a plain object so Cordis always accepts the value, while tests and
  // diagnostics can still reach the live manager through its properties.
  const result = () => {}
  result.manager = manager
  result.config = normalized
  result.registeredProviders = providerIds
  return result
}
