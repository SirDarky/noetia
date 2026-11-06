import { describe, expect, it } from 'vitest'
import { getTheme, themes } from './themes'

function luminance(hex: string) {
  const channels = [1, 3, 5].map(start => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (values[0] + .05) / (values[1] + .05)
}

describe('theme compatibility and readable palettes', () => {
  it('preserves existing preferences and safely handles an unknown stored theme', () => {
    expect(getTheme('light').mode).toBe('light')
    expect(getTheme('dark').mode).toBe('dark')
    expect(getTheme('removed-custom-theme').id).toBe('dark')
  })
  for (const theme of themes) it(`${theme.name} keeps body, supporting text and primary buttons readable`, () => {
    const p = theme.palette
    expect(contrast(p.reading, p.background)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.mutedForeground, p.card)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(p.primaryForeground, p.primary)).toBeGreaterThanOrEqual(4.5)
  })
})
