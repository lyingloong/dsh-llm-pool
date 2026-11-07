import assert from 'node:assert/strict'
import test from 'node:test'

import {
  aggregateFailures,
  classifyFailure,
  cooldownMs,
  mergeModelInfo,
  normalizeConfig,
  normalizeRetryPolicy,
} from '../lib/pool.js'

function info(overrides = {}) {
  return {
    provider: 'a',
    id: 'm',
    name: 'm',
    context: { contextWindow: 1000 },
    inputModalities: ['text'],
    reasoning: {
      efforts: [
        { id: 'low', name: 'low' },
        { id: 'high', name: 'high' },
      ],
      defaultEffort: 'low',
    },
    ...overrides,
  }
}

test('normalizeConfig accepts a pool and materializes same-id targets', () => {
  const result = normalizeConfig({
    providers: {
      'ustc-pool': {
        displayName: 'USTC 统一池',
        members: ['ustc', 'ustc-dhsun'],
        models: [{ id: 'deepseek-flash' }],
      },
    },
  })
  assert.equal(result.diagnostics.filter((d) => d.level === 'error').length, 0)
  assert.equal(result.pools.length, 1)
  const pool = result.pools[0]
  assert.equal(pool.displayName, 'USTC 统一池')
  assert.equal(pool.strategy, 'sticky')
  assert.deepEqual(pool.models[0].targets, [
    { member: 'ustc', model: 'deepseek-flash' },
    { member: 'ustc-dhsun', model: 'deepseek-flash' },
  ])
  assert.equal(result.providers['ustc-pool'].models[0].targets.ustc, 'deepseek-flash')
})

test('normalizeConfig rejects nested pools and removes that member', () => {
  const result = normalizeConfig({
    providers: {
      a: { members: ['b'], models: [{ id: 'm' }] },
      b: { members: ['a'], models: [{ id: 'm' }] },
    },
  })
  assert.ok(result.diagnostics.some((d) => d.level === 'error' && d.message.includes('不允许嵌套')))
  assert.equal(result.pools.length, 0)
})

test('normalizeConfig keeps invalid pools out but reports diagnostics', () => {
  const result = normalizeConfig({
    providers: {
      bad: { members: [], models: [{ id: 'm' }] },
      good: { members: ['a'], models: [{ id: 'm', targets: { b: 'x' } }] },
    },
  })
  assert.equal(result.pools.length, 1)
  assert.equal(result.pools[0].id, 'good')
  assert.equal(result.pools[0].models.length, 0)
  assert.ok(result.diagnostics.some((d) => d.level === 'error'))
})

test('mergeModelInfo takes the conservative context, union of images, and intersection of efforts', () => {
  const pool = {
    id: 'pool',
    strategy: 'sticky',
    members: ['a', 'b'],
    models: [],
  }
  const model = {
    id: 'm',
    name: 'M',
    targets: [
      { member: 'a', model: 'm' },
      { member: 'b', model: 'm' },
    ],
    efforts: undefined,
    effortMap: undefined,
  }
  const merged = mergeModelInfo(pool, model, [
    {
      member: 'a',
      targetModel: 'm',
      info: info({
        context: { contextWindow: 1000 },
        inputModalities: ['text', 'image'],
        systemPromptUpdate: 'in-history',
        toolUpdate: 'in-history',
        reasoning: {
          efforts: [
            { id: 'low', name: 'low' },
            { id: 'high', name: 'high' },
          ],
          defaultEffort: 'low',
        },
      }),
    },
    {
      member: 'b',
      targetModel: 'm',
      info: info({
        context: { contextWindow: 2000 },
        inputModalities: ['text'],
        toolUpdate: 'addition-only',
        reasoning: {
          efforts: [
            { id: 'low', name: 'low' },
            { id: 'medium', name: 'medium' },
          ],
          defaultEffort: 'low',
        },
      }),
    },
  ])
  assert.equal(merged.context.contextWindow, 1000)
  assert.deepEqual(merged.inputModalities, ['text', 'image'])
  assert.deepEqual(
    merged.reasoning.efforts.map((effort) => effort.id),
    ['low'],
  )
  assert.equal(merged.systemPromptUpdate, undefined)
  assert.equal(merged.toolUpdate, 'addition-only')
  assert.equal(merged.provider, 'pool')
  assert.equal(merged.id, 'm')
  assert.equal(merged.name, 'M')
})

test('mergeModelInfo honors explicit efforts and defaults', () => {
  const pool = { id: 'pool', strategy: 'sticky', members: ['a'], models: [] }
  const model = {
    id: 'm',
    name: 'm',
    targets: [{ member: 'a', model: 'm' }],
    efforts: [
      { id: 'max', name: 'Max' },
      { id: 'high', name: 'High' },
    ],
    defaultEffort: 'max',
    effortMap: undefined,
  }
  const merged = mergeModelInfo(pool, model, [
    { member: 'a', targetModel: 'm', info: info() },
  ])
  assert.deepEqual(
    merged.reasoning.efforts.map((effort) => effort.id),
    ['max', 'high'],
  )
  assert.equal(merged.reasoning.defaultEffort, 'max')
})

test('failure classification and cooldown', () => {
  assert.deepEqual(classifyFailure('SERVER'), { fallback: true, cooldown: 'model' })
  assert.deepEqual(classifyFailure('AUTH'), { fallback: true, cooldown: 'provider' })
  assert.deepEqual(classifyFailure('INVALID_REQUEST'), { fallback: true, cooldown: null })
  assert.deepEqual(classifyFailure('ABORTED'), { fallback: false, cooldown: null })
  assert.deepEqual(classifyFailure('IMAGE_OFFLOAD_REQUIRED'), { fallback: false, cooldown: null })
  assert.equal(cooldownMs('RATE_LIMIT', { providerRetryAfterMs: 5000 }), 5000)
  assert.equal(cooldownMs('SERVER', {}), 30_000)
})

test('aggregateFailures prefers a request code, then a transient code', () => {
  const request = aggregateFailures('pool', 'm', [
    { member: 'a', targetModel: 'm', failure: { code: 'SERVER', message: 'server boom' } },
    { member: 'b', targetModel: 'm', failure: { code: 'INVALID_REQUEST', message: 'bad request' } },
  ])
  assert.equal(request.code, 'INVALID_REQUEST')
  assert.ok(request.message.includes('全部失败'))

  const transient = aggregateFailures('pool', 'm', [
    { member: 'a', targetModel: 'm', failure: { code: 'AUTH', message: 'bad key' } },
    { member: 'b', targetModel: 'm', failure: { code: 'TIMEOUT', message: 'timeout' } },
  ])
  assert.equal(transient.code, 'TIMEOUT')
})

test('retry policy defaults and overrides', () => {
  const defaults = normalizeRetryPolicy(undefined)
  assert.equal(defaults.mode, 'normal')
  assert.equal(defaults.maxRetries, 2)
  assert.deepEqual(defaults.retryableCodes, ['EMPTY_RESPONSE', 'RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT'])

  const custom = normalizeRetryPolicy({ mode: 'normal', maxRetries: 0, retryableCodes: ['SERVER'], backoff: { initialDelayMs: 10, maxDelayMs: 20 } })
  assert.equal(custom.maxRetries, 0)
  assert.deepEqual(custom.retryableCodes, ['SERVER'])
  assert.equal(custom.initialDelayMs, 10)
  assert.equal(custom.maxDelayMs, 20)
})

test('pool policy config is serializable and stable', () => {
  const result = normalizeConfig({
    retryPolicy: { maxRetries: 1 },
    providers: {
      p: {
        displayName: 'P',
        strategy: 'failover',
        members: ['a', 'b'],
        cooldown: { serverMs: 1234 },
        models: [
          {
            id: 'm',
            name: 'M',
            targets: { a: 'm1', b: 'm2' },
            contextWindow: 4096,
            input: ['text'],
            efforts: ['low', 'high'],
            defaultEffort: 'high',
            effortMap: { b: { high: 'max' } },
          },
        ],
      },
    },
  })
  assert.equal(result.pools[0].strategy, 'failover')
  assert.equal(result.pools[0].cooldown.serverMs, 1234)
  assert.deepEqual(result.pools[0].models[0].efforts.map((e) => e.id), ['low', 'high'])
  assert.equal(result.providers.p.models[0].contextWindow, 4096)
})
