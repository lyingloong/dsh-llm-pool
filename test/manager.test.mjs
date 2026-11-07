import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeConfig, testSessionId } from '../lib/pool.js'
import { PoolManager, createPoolAdapter } from '../lib/manager.js'

function info(provider, model, options = {}) {
  const value = {
    provider,
    id: model,
    name: model,
    context: { contextWindow: options.contextWindow ?? 100_000 },
    inputModalities: options.inputModalities ?? ['text'],
    ...(options.defaultMaxTokens === undefined ? {} : { defaultMaxTokens: options.defaultMaxTokens }),
    ...(options.systemPromptUpdate === undefined ? {} : { systemPromptUpdate: options.systemPromptUpdate }),
    ...(options.toolUpdate === undefined ? {} : { toolUpdate: options.toolUpdate }),
  }
  if (options.reasoning !== false) {
    value.reasoning = options.reasoning ?? {
      efforts: [
        { id: 'low', name: 'low' },
        { id: 'high', name: 'high' },
      ],
      defaultEffort: 'low',
    }
  }
  return value
}

function success(label, replayState) {
  return async function* () {
    yield { type: 'text-delta', index: 0, text: label }
    yield {
      type: 'finish',
      reason: { kind: 'stop' },
      ...(replayState === undefined ? {} : { replayState }),
    }
  }
}

function failure(code = 'SERVER', message = 'boom', afterText) {
  return async function* () {
    if (afterText !== undefined) yield { type: 'text-delta', index: 0, text: afterText }
    yield { type: 'finish', reason: { kind: 'error', failure: { code, message } } }
  }
}

function emptyResponse() {
  return async function* () {
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

class FakeLlm {
  constructor(providers) {
    this.providers = providers
    this.calls = []
  }

  listProviders() {
    return Object.keys(this.providers).map((id) => ({ id, name: id }))
  }

  async listModels(provider) {
    const p = this.providers[provider]
    if (p === undefined) throw new Error(`unknown provider ${provider}`)
    return Object.keys(p.models).map((id) => ({ provider, id, name: id }))
  }

  async resolveModelInfo(provider, model) {
    const p = this.providers[provider]
    const m = p?.models[model]
    if (m === undefined) throw new Error(`unknown model ${provider}/${model}`)
    return m.info
  }

  stream(options) {
    this.calls.push(options)
    const p = this.providers[options.provider]
    const m = p?.models[options.model]
    if (m === undefined) {
      return (async function* () {
        yield { type: 'finish', reason: { kind: 'error', failure: { code: 'UNKNOWN_MODEL', message: 'missing' } } }
      })()
    }
    return m.script(options)
  }
}

function buildConfig(models = {}, poolOverrides = {}, retryPolicy) {
  return normalizeConfig({
    providers: {
      pool: {
        members: ['a', 'b', 'c'],
        ...poolOverrides,
        models: [
          {
            id: 'm',
            targets: { a: 'm', b: 'm', c: 'm' },
            ...models,
          },
        ],
      },
    },
    ...(retryPolicy === undefined ? {} : { retryPolicy }),
  })
}

function makeProviders() {
  return {
    a: { models: { m: { info: info('a', 'm'), script: success('a') } } },
    b: { models: { m: { info: info('b', 'm'), script: success('b') } } },
    c: { models: { m: { info: info('c', 'm'), script: success('c') } } },
  }
}

async function collect(iterable) {
  const chunks = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

function textOf(chunks) {
  return chunks
    .filter((chunk) => chunk.type === 'text-delta')
    .map((chunk) => chunk.text)
    .join('')
}

function makeRuntime(providers, config) {
  const llm = new FakeLlm(providers)
  const manager = new PoolManager({ llm, config, now: () => 1_000_000 })
  const adapter = createPoolAdapter({ manager })
  return { llm, manager, adapter }
}

test('sticky assignment balances new sessions and keeps each session on one member', async () => {
  const { manager, adapter } = makeRuntime(makeProviders(), buildConfig())
  const s1 = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] })))
  const s2 = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's2', messages: [] })))
  const s3 = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's3', messages: [] })))
  const s1again = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] })))
  assert.equal(new Set([s1, s2, s3]).size, 3)
  assert.equal(s1again, s1)
  assert.equal(manager.preferred.get('s1\u0000pool'), s1)
  assert.equal(manager.preferred.get('s2\u0000pool'), s2)
  assert.equal(manager.preferred.get('s3\u0000pool'), s3)
})

test('pre-token failure falls back and reassigns the session to the winner', async () => {
  const providers = makeProviders()
  providers.a.models.m.script = failure('SERVER', 'a is down')
  providers.b.models.m.script = success('b')
  const { manager, adapter } = makeRuntime(providers, buildConfig())
  manager.setPreferred('s1', manager.pool('pool'), 'a')
  const chunks = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] }))
  assert.equal(textOf(chunks), 'b')
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(manager.preferred.get('s1\u0000pool'), 'b')
})

test('post-content failure is terminal and is not concatenated with another member', async () => {
  const providers = makeProviders()
  providers.a.models.m.script = failure('SERVER', 'mid-stream', 'partial-a')
  providers.b.models.m.script = success('b')
  const { manager, adapter } = makeRuntime(providers, buildConfig())
  manager.setPreferred('s1', manager.pool('pool'), 'a')
  const chunks = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] }))
  assert.equal(textOf(chunks), 'partial-a')
  assert.equal(chunks.at(-1).reason.kind, 'error')
  assert.equal(chunks.at(-1).reason.failure.code, 'SERVER')
  assert.equal(providers.b.models.m.script.toString().includes('b'), true)
  assert.equal(manager.preferred.get('s1\u0000pool'), 'a')
})

test('empty successful response falls back', async () => {
  const providers = makeProviders()
  providers.a.models.m.script = emptyResponse()
  const { manager, adapter } = makeRuntime(providers, buildConfig())
  manager.setPreferred('s1', manager.pool('pool'), 'a')
  const chunks = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] }))
  assert.equal(textOf(chunks), 'b')
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(manager.preferred.get('s1\u0000pool'), 'b')
})

test('image requests skip text-only members', async () => {
  const providers = makeProviders()
  providers.a.models.m.info = info('a', 'm', { inputModalities: ['text'] })
  providers.b.models.m.info = info('b', 'm', { inputModalities: ['text', 'image'] })
  providers.c.models.m.info = info('c', 'm', { inputModalities: ['text'] })
  const { manager, adapter } = makeRuntime(providers, buildConfig({ input: ['text', 'image'] }))
  manager.setPreferred('s1', manager.pool('pool'), 'a')
  const messages = [{ role: 'user', content: [{ type: 'image', attachment: { attachmentId: 'x' } }] }]
  const chunks = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages }))
  assert.equal(textOf(chunks), 'b')
})

test('reasoning effort filters candidates and applies an explicit mapping', async () => {
  const providers = makeProviders()
  providers.a.models.m.info = info('a', 'm', {
    reasoning: { efforts: [{ id: 'low', name: 'low' }], defaultEffort: 'low' },
  })
  providers.b.models.m.info = info('b', 'm', {
    reasoning: { efforts: [{ id: 'low', name: 'low' }], defaultEffort: 'low' },
  })
  providers.c.models.m.info = info('c', 'm', {
    reasoning: { efforts: [{ id: 'low', name: 'low' }], defaultEffort: 'low' },
  })
  const config = buildConfig({
    efforts: ['low', 'high'],
    effortMap: { a: { high: 'max' } },
  })
  const { llm, manager, adapter } = makeRuntime(providers, config)
  manager.setPreferred('s1', manager.pool('pool'), 'b')
  const chunks = await collect(
    adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', reasoningEffort: 'high', messages: [] }),
  )
  assert.equal(textOf(chunks), 'a')
  const call = llm.calls.at(-1)
  assert.equal(call.provider, 'a')
  assert.equal(call.reasoningEffort, 'max')
})

test('test sessions never create assignments and can target a member', async () => {
  const { manager, adapter } = makeRuntime(makeProviders(), buildConfig())
  const sessionId = testSessionId('b')
  const chunks = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId, messages: [] }))
  assert.equal(textOf(chunks), 'b')
  assert.equal(manager.preferred.size, 0)
  assert.equal(manager.preferredCounts.size, 0)
  assert.ok(manager.recentForSession(sessionId).some((attempt) => attempt.outcome === 'success'))
})

test('session disposal releases balancing counts', async () => {
  const { manager, adapter } = makeRuntime(makeProviders(), buildConfig())
  await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] }))
  assert.equal(manager.preferredCounts.get('pool\u0000a') ?? manager.preferredCounts.get('pool\u0000b') ?? manager.preferredCounts.get('pool\u0000c'), 1)
  manager.forgetSession('s1')
  assert.equal(manager.preferred.size, 0)
  assert.equal(manager.preferredCounts.size, 0)
})

test('no registered member produces a NO_CANDIDATES terminal failure', async () => {
  const providers = makeProviders()
  delete providers.a
  delete providers.b
  delete providers.c
  const { adapter } = makeRuntime(providers, buildConfig())
  const chunks = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] }))
  assert.equal(chunks.at(-1).reason.kind, 'error')
  assert.equal(chunks.at(-1).reason.failure.code, 'NO_CANDIDATES')
})

test('replay state is wrapped with its concrete route and restored for the same route', async () => {
  const providers = makeProviders()
  providers.b.models.m.script = success('b', { response: 'opaque' })
  const { llm, manager, adapter } = makeRuntime(providers, buildConfig())
  manager.setPreferred('s1', manager.pool('pool'), 'b')
  const first = await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] }))
  const finish = first.at(-1)
  assert.equal(finish.replayState.__llmPool, 1)
  assert.deepEqual(finish.replayState.inner, { response: 'opaque' })

  const assistant = {
    id: 'assistant-1',
    role: 'assistant',
    content: [{ type: 'text', text: 'b' }],
    source: {
      kind: 'model',
      provider: 'pool',
      model: 'm',
      replayState: finish.replayState,
    },
  }
  const messages = [
    { id: 'user-1', role: 'user', content: [{ type: 'text', text: 'hi' }], source: { kind: 'user' } },
    assistant,
  ]
  await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages }))
  const innerCall = llm.calls.at(-1)
  assert.equal(innerCall.messages[1].source.provider, 'b')
  assert.equal(innerCall.messages[1].source.model, 'm')
  assert.deepEqual(innerCall.messages[1].source.replayState, { response: 'opaque' })
})

test('round-robin strategy advances every call', async () => {
  const { manager, adapter } = makeRuntime(makeProviders(), buildConfig({}, { strategy: 'round-robin' }))
  const one = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] })))
  const two = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] })))
  const three = textOf(await collect(adapter.stream({ provider: 'pool', model: 'm', sessionId: 's1', messages: [] })))
  assert.equal(new Set([one, two, three]).size, 3)
  assert.equal(manager.preferred.size, 0)
})

test('adapter exposes the model catalog and composed metadata the picker consumes', async () => {
  const providers = makeProviders()
  providers.a.models.m.info = info('a', 'm', { contextWindow: 1000, inputModalities: ['text', 'image'] })
  providers.b.models.m.info = info('b', 'm', { contextWindow: 4000, inputModalities: ['text'] })
  const { adapter } = makeRuntime(providers, buildConfig({ name: 'Unified M' }))
  const models = adapter.listModels('pool')
  assert.deepEqual(models.map((model) => model.id), ['m'])
  assert.equal(models[0].provider, 'pool')
  const resolved = await adapter.resolveModel('pool', 'm')
  assert.equal(resolved.provider, 'pool')
  assert.equal(resolved.id, 'm')
  assert.equal(resolved.name, 'Unified M')
  assert.equal(resolved.context.contextWindow, 1000)
  assert.deepEqual(resolved.inputModalities, ['text', 'image'])
  assert.ok(resolved.reasoning.efforts.length > 0)
  assert.equal(adapter.providerInfo('pool').name, 'pool')
  assert.equal(adapter.providerRetryPolicy('pool').mode, 'normal')
})
