import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NODE_HANDLE_OFFSET_FLOW,
  NODE_HANDLE_ZONE_INSET_FLOW,
  NODE_HANDLE_ZONE_SIZE_FLOW,
  getNodeHandleMagnetPull,
  getNodeHandleMagnetRadius,
} from '../src/utils/nodeHandleGeometry'

test('node handles sit farther outside the card with a larger hit zone', () => {
  assert.equal(NODE_HANDLE_OFFSET_FLOW, 22)
  assert.equal(NODE_HANDLE_ZONE_SIZE_FLOW, 88)
  assert.equal(NODE_HANDLE_ZONE_INSET_FLOW, -66)
})

test('node handle magnetism reaches farther and pulls more strongly', () => {
  assert.equal(getNodeHandleMagnetRadius(1), 42)
  assert.equal(getNodeHandleMagnetPull(1), 16)
  assert.equal(
    getNodeHandleMagnetRadius(1) <= NODE_HANDLE_ZONE_SIZE_FLOW / 2,
    true,
  )
})
