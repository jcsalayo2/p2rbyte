import { describe, expect, it } from 'vitest'
import { getIceConfiguration } from '../ice'

describe('getIceConfiguration', () => {
  it('includes STUN servers', () => {
    const config = getIceConfiguration()
    expect(config.iceServers?.length).toBeGreaterThan(0)
    expect(config.iceServers?.[0]?.urls).toContain('stun:')
  })
})
