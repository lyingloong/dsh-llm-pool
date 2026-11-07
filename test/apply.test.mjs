import assert from 'node:assert/strict'
import test from 'node:test'

import { apply } from '../index.js'

function makeCtx() {
  const registered = []
  const listeners = []
  const ctx = {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    llm: {
      listProviders() {
        return [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
        ]
      },
      registerAdapter(providers, _adapter) {
        registered.push(...providers)
        return () => {}
      },
    },
    on(event, listener) {
      listeners.push({ event, listener })
      return () => {}
    },
    get() {
      return undefined
    },
    effect(callback) {
      return callback()
    },
  }
  return { ctx, registered, listeners }
}

test('apply registers one virtual route per configured pool', () => {
  const { ctx, registered } = makeCtx()
  const result = apply(ctx, {
    providers: {
      'ustc-pool': {
        displayName: 'USTC 统一池',
        members: ['a', 'b'],
        models: [{ id: 'm' }],
      },
    },
  })
  assert.deepEqual(registered, ['ustc-pool'])
  assert.deepEqual(result.registeredProviders, ['ustc-pool'])
  assert.equal(result.manager.pool('ustc-pool').displayName, 'USTC 统一池')
})

test('apply skips a pool whose route id collides with a real provider', () => {
  const { ctx, registered } = makeCtx()
  const result = apply(ctx, {
    providers: {
      a: { members: ['a', 'b'], models: [{ id: 'm' }] },
    },
  })
  assert.deepEqual(registered, [])
  assert.equal(result.config.diagnostics.some((d) => d.level === 'error' && d.message.includes('重名')), true)
})

test('apply tolerates an empty configuration', () => {
  const { ctx, registered } = makeCtx()
  const result = apply(ctx, {})
  assert.deepEqual(registered, [])
  assert.equal(result.config.pools.length, 0)
})
