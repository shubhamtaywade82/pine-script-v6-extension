export const PINE_V6_SETTINGS_NOTIFICATION = 'pineV6/settings';

export interface PineV6Settings {
  enable: boolean;
  maxNumberOfProblems: number;
  strictVersionCheck: boolean;
}

export const defaultPineV6Settings: PineV6Settings = {
  enable: true,
  maxNumberOfProblems: 100,
  strictVersionCheck: true,
};
