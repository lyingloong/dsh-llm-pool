import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeConfig } from '../lib/pool.js'
import { PoolManager } from '../lib/manager.js'
import { createPoolServer, createResponseRecorder } from '../lib/server.js'

function fakeLlm() {
  return {
    listProviders() {
      return [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ]
    },
    async listModels(provider) {
      return [{ provider, id: provider + '-model', name: provider + '-model' }]
    },
    async resolveModelInfo(provider, model) {
      return {
        provider,
        id: model,
        name: model,
        context: { contextWindow: 1000 },
        inputModalities: ['text'],
        reasoning: { efforts: [{ id: 'low', name: 'low' }], defaultEffort: 'low' },
      }
    },
  }
}

test('status projection contains config, available channels, and pool health', async () => {
  const config = normalizeConfig({
    providers: {
      pool: {
        displayName: 'Pool',
        members: ['a', 'b'],
        models: [{ id: 'm', targets: { a: 'a-model', b: 'b-model' } }],
      },
    },
  })
  const llm = fakeLlm()
  const manager = new PoolManager({ llm, config })
  const server = createPoolServer({ config, manager, llm })
  const value = await server.statusValue()
  assert.equal(value.version, '0.1.0')
  assert.equal(value.writable, false)
  assert.deepEqual(value.availableProviders.map((provider) => provider.id), ['a', 'b'])
  assert.equal(value.pools.length, 1)
  assert.equal(value.pools[0].id, 'pool')
  assert.deepEqual(value.pools[0].members, ['a', 'b'])
  assert.equal(value.pools[0].models[0].targets.a, 'a-model')
  assert.equal(value.config.providers.pool.members.length, 2)
  assert.ok(Array.isArray(value.diagnostics))
})

function fakeRequest(method, body) {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    on(event, callback) {
      if (event === 'data') callback(Buffer.from(body))
      if (event === 'end') callback()
      return this
    },
    destroy() {},
  }
}

function makeServerWithEditor() {
  const captured = new Map()
  const webServer = {
    register(route) {
      captured.set(route.path, route.handler)
      return () => {}
    },
  }
  const connection = { requestRejection: () => undefined }
  const config = normalizeConfig({ providers: {} })
  const llm = fakeLlm()
  const manager = new PoolManager({ llm, config })
  const entry = {
    options: {
      id: 'llm-pool',
      name: 'dsh-llm-pool',
      config: { providers: {} },
    },
  }
  const edits = []
  const configEditor = {
    entries() {
      return [entry]
    },
    async edit(target, change) {
      edits.push(change(structuredClone(target.options.config), {}))
    },
  }
  const server = createPoolServer({ config, manager, llm, configEditor })
  const dispose = server.register(webServer, connection)
  return { captured, edits, dispose }
}

test('save accepts a valid config and schedules a profile edit', async () => {
  const { captured, edits } = makeServerWithEditor()
  const handler = captured.get('/llm-pool/save')
  assert.equal(typeof handler, 'function')
  const body = JSON.stringify({
    providers: {
      'ustc-pool': {
        members: ['a'],
        models: [{ id: 'm', targets: { a: 'a-model' } }],
      },
    },
  })
  const response = createResponseRecorder()
  await handler(fakeRequest('POST', body), response, {})
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(response.statusCode, 202)
  assert.equal(edits.length, 1)
  assert.equal(edits[0].providers['ustc-pool'].members[0], 'a')
  assert.equal(edits[0].providers['ustc-pool'].models[0].targets.a, 'a-model')
})

test('save rejects an invalid config before scheduling an edit', async () => {
  const { captured, edits } = makeServerWithEditor()
  const handler = captured.get('/llm-pool/save')
  const body = JSON.stringify({ providers: { 'bad-pool': { members: [], models: [] } } })
  const response = createResponseRecorder()
  await handler(fakeRequest('POST', body), response, {})
  assert.equal(response.statusCode, 400)
  assert.equal(edits.length, 0)
})
