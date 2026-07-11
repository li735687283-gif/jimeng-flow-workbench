import { test } from 'node:test'
import assert from 'node:assert/strict'

test('getFlow preserves the backend status and error code', async () => {
  const flowsApi = await import('../src/api/flows')
  const { getFlow } = flowsApi
  const isFlowNotFoundError = (
    flowsApi as unknown as {
      isFlowNotFoundError?: (error: unknown) => boolean
    }
  ).isFlowNotFoundError
  const originalFetch = globalThis.fetch

  assert.equal(typeof isFlowNotFoundError, 'function')

  Object.assign(globalThis, {
    fetch: async () =>
      Response.json(
        {
          statusCode: 404,
          error: 'Not Found',
          message: 'Flow missing-flow not found',
          code: 'FLOW_NOT_FOUND',
        },
        { status: 404, statusText: 'Not Found' },
      ),
  })

  try {
    await assert.rejects(
      () => getFlow('missing-flow'),
      (error: unknown) => {
        const apiError = error as Error & {
          status?: number
          code?: string
        }
        assert.equal(apiError.message, 'Flow missing-flow not found')
        assert.equal(apiError.status, 404)
        assert.equal(apiError.code, 'FLOW_NOT_FOUND')
        assert.equal(isFlowNotFoundError?.(apiError), true)
        return true
      },
    )
  } finally {
    Object.assign(globalThis, { fetch: originalFetch })
  }
})

test('flow-not-found classification rejects unrelated failures', async () => {
  const { FlowApiError, isFlowNotFoundError } = await import('../src/api/flows')

  assert.equal(
    isFlowNotFoundError(new FlowApiError('server error', 500, 'FLOW_NOT_FOUND')),
    false,
  )
  assert.equal(
    isFlowNotFoundError(new FlowApiError('missing', 404, 'OTHER_NOT_FOUND')),
    false,
  )
  assert.equal(isFlowNotFoundError(new Error('network unavailable')), false)
})
