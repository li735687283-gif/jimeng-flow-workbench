const MAX_AGENT_IMAGE_PROMPT_LENGTH = 800

const SAFE_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bdeep\s*[- ]?v\s+cutout\s+from\s+chest\s+to\s+abdomen\b/gi, 'structured asymmetrical neckline'],
  [/\bhigh\s*[- ]?slit(?:\s+to\s+(?:the\s+)?waist)?\b/gi, 'asymmetrical tactical tailoring'],
  [/\b(?:sexy|sensual|seductive|erotic|nude|naked|topless|lingerie|cleavage|breasts?)\b/gi, ''],
  [/\bcurvy\b/gi, 'athletic'],
  [/(?:超性感|性感|情色|裸露|裸体|全裸|半裸|内衣)/gu, '时尚'],
  [/(?:胸口)?深\s*V/giu, '结构化领口'],
  [/(?:服装)?高衩/gu, '不对称剪裁'],
]

export function prepareAgentImagePrompt(value: string): string {
  let prepared = value.trim()

  for (const [pattern, replacement] of SAFE_REPLACEMENTS) {
    prepared = prepared.replace(pattern, replacement)
  }

  prepared = prepared
    .replace(/\bathletic\s+athletic\b/gi, 'athletic')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:，。；：])/g, '$1')
    .trim()

  if (prepared.length <= MAX_AGENT_IMAGE_PROMPT_LENGTH) return prepared

  const truncated = prepared.slice(0, MAX_AGENT_IMAGE_PROMPT_LENGTH)
  const boundary = Math.max(
    truncated.lastIndexOf('. '),
    truncated.lastIndexOf(', '),
    truncated.lastIndexOf('；'),
  )
  const minimumUsefulBoundary = Math.floor(MAX_AGENT_IMAGE_PROMPT_LENGTH * 0.65)
  return boundary >= minimumUsefulBoundary
    ? truncated.slice(0, boundary + 1).trim()
    : truncated.trim()
}
