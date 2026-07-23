export type ParticleRgba = readonly [number, number, number, number]

export interface ThemeParticlePalette {
  base: ParticleRgba
  hot: ParticleRgba
}

const FALLBACK_PALETTE: ThemeParticlePalette = {
  base: [255, 255, 255, 0.13],
  hot: [255, 215, 0, 0.82],
}

function parseRgb(value: string, fallback: ParticleRgba): ParticleRgba {
  const channels = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter(Number.isFinite)
  if (channels.length !== 3) return fallback
  return [channels[0], channels[1], channels[2], fallback[3]]
}

function parseAlpha(value: string, fallback: number): number {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : fallback
}

export function readThemeParticlePalette(
  root: Element = document.documentElement,
): ThemeParticlePalette {
  const style = getComputedStyle(root)
  const base = parseRgb(
    style.getPropertyValue('--theme-particle-base'),
    FALLBACK_PALETTE.base,
  )
  const hot = parseRgb(
    style.getPropertyValue('--theme-particle-hot'),
    FALLBACK_PALETTE.hot,
  )
  return {
    base: [
      base[0],
      base[1],
      base[2],
      parseAlpha(
        style.getPropertyValue('--theme-particle-base-alpha'),
        FALLBACK_PALETTE.base[3],
      ),
    ],
    hot: [
      hot[0],
      hot[1],
      hot[2],
      parseAlpha(
        style.getPropertyValue('--theme-particle-hot-alpha'),
        FALLBACK_PALETTE.hot[3],
      ),
    ],
  }
}
