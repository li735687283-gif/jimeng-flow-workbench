import { DEFAULT_SETTINGS, type Settings } from '@jimeng-flow/shared'

export function createSettingsDraft(persisted: Settings | null | undefined): Settings {
  return { ...(persisted ?? DEFAULT_SETTINGS) }
}

export function getSettingsModalGuards(submitting: boolean) {
  return {
    closeBlocked: submitting,
    saveBlocked: submitting,
  }
}
