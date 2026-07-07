import assert from 'node:assert/strict'
import test from 'node:test'
import { AGENT_ROLES } from '@jimeng-flow/shared/agentMessage'

const isGrayHex = (color: string) => {
  const match = color.match(/^#([0-9a-fA-F]{6})$/)
  if (!match) return false
  const [, hex] = match
  const channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((value) => value.toLowerCase())
  return channels[0] === channels[1] && channels[1] === channels[2]
}

test('agent role colors stay in the black white gray palette', () => {
  for (const role of AGENT_ROLES) {
    assert.equal(isGrayHex(role.color), true, `${role.id} uses non-gray color ${role.color}`)
  }
})
