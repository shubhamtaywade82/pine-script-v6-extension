export const PINE_FORGE_SETTINGS_NOTIFICATION = 'pineForge/settings';

export interface PineForgeSettings {
  enable: boolean;
  maxNumberOfProblems: number;
  strictVersionCheck: boolean;
}

export const defaultPineForgeSettings: PineForgeSettings = {
  enable: true,
  maxNumberOfProblems: 100,
  strictVersionCheck: true,
};
