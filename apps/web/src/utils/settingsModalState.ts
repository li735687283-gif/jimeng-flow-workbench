import {
  DEFAULT_SETTINGS,
  SETTINGS_SECRET_KEYS,
  SETTINGS_SECRET_MASK,
  type Settings,
} from '@jimeng-flow/shared'

export function createSettingsDraft(persisted: Settings | null | undefined): Settings {
  return { ...(persisted ?? DEFAULT_SETTINGS) }
}

export function isSettingsSecretMasked(value: unknown): boolean {
  return value === SETTINGS_SECRET_MASK
}

export function omitMaskedSettingsSecrets(
  settings: Partial<Settings>,
): Partial<Settings> {
  const sanitized = { ...settings }
  for (const key of SETTINGS_SECRET_KEYS) {
    if (isSettingsSecretMasked(sanitized[key])) {
      delete sanitized[key]
    }
  }
  return sanitized
}

export function getSettingsModalGuards(submitting: boolean) {
  return {
    closeBlocked: submitting,
    saveBlocked: submitting,
  }
}
