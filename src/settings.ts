export const PINE_FORGE_SETTINGS_NOTIFICATION = 'pineForge/settings';

export interface PineForgeSettings {
  enable: boolean;
  maxNumberOfProblems: number;
  strictVersionCheck: boolean;
  /**
   * When true, flags bare `if close`-style conditions (series used as bool) only when the
   * condition is obviously a single identifier on the same line (conservative).
   */
  strictImplicitBoolIf: boolean;
}

export const defaultPineForgeSettings: PineForgeSettings = {
  enable: true,
  maxNumberOfProblems: 100,
  strictVersionCheck: true,
  strictImplicitBoolIf: true,
};
