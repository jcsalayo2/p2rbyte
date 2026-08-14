import { describe, expect, it } from 'vitest'
import {
  getDirectIceConfiguration,
  getFullIceConfiguration,
  getIceConfiguration,
  getInitialIceConfiguration,
  hasTurnServers,
} from '../ice'

describe('getDirectIceConfiguration', () => {
  it('includes STUN only — describes the preferred direct path', () => {
    const config = getDirectIceConfiguration()
    const urls = (config.iceServers ?? []).flatMap((s) =>
      Array.isArray(s.urls) ? s.urls : [s.urls],
    )
    expect(urls.some((u) => u.includes('stun:'))).toBe(true)
    expect(urls.some((u) => /turn/i.test(u))).toBe(false)
    expect(config.iceCandidatePoolSize).toBe(0)
  })
})

describe('getInitialIceConfiguration', () => {
  it('includes STUN and TURN at PC creation (Chrome cannot add TURN later)', () => {
    const config = getInitialIceConfiguration()
    expect(config.iceServers?.length).toBeGreaterThan(2)
    expect(config.iceServers?.some((s) => String(s.urls).includes('stun:'))).toBe(true)
    expect(config.iceServers?.some((s) => String(s.urls).includes('turn:'))).toBe(true)
    expect(config.iceCandidatePoolSize).toBe(0)
  })

  it('matches getFullIceConfiguration and getIceConfiguration', () => {
    expect(getFullIceConfiguration()).toEqual(getInitialIceConfiguration())
    expect(getIceConfiguration()).toEqual(getInitialIceConfiguration())
  })

  it('hasTurnServers is true when fallback TURN is available', () => {
    expect(hasTurnServers()).toBe(true)
  })
})
