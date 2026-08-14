import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateRoomId, getJoinUrl, isValidRoomId } from '../roomId'

describe('roomId', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('generateRoomId returns 6-char valid id', () => {
    const id = generateRoomId()
    expect(id).toHaveLength(6)
    expect(isValidRoomId(id)).toBe(true)
  })

  it('isValidRoomId rejects wrong length', () => {
    expect(isValidRoomId('ABC12')).toBe(false)
  })

  it('isValidRoomId accepts valid code', () => {
    expect(isValidRoomId('ABC123')).toBe(true)
  })

  it('getJoinUrl uses VITE_APP_URL when set', () => {
    vi.stubEnv('VITE_APP_URL', 'https://p2rbyte.web.app')
    expect(getJoinUrl('ABC123')).toBe('https://p2rbyte.web.app/join/ABC123')
  })

  it('getJoinUrl falls back to window.location.origin', () => {
    vi.stubEnv('VITE_APP_URL', '')
    expect(getJoinUrl('ABC123')).toBe(`${window.location.origin}/join/ABC123`)
  })
})
