export type ForestIslandTheme = "spring" | "harvest" | "moonlight";
export type ForestCottageAccent = "mint" | "coral" | "honey";
export type ForestFeaturedReward = "none" | "birdhouse" | "picnic" | "campfire";

export type ForestPreferences = {
  islandTheme: ForestIslandTheme;
  cottageAccent: ForestCottageAccent;
  featuredReward: ForestFeaturedReward;
};

export type ForestCustomizationOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  color?: string;
  requiredTrees: number;
  unlocked?: boolean;
  remainingTrees?: number;
};

export const forestThemeOptions: ForestCustomizationOption<ForestIslandTheme>[];
export const cottageAccentOptions: ForestCustomizationOption<ForestCottageAccent>[];
export const featuredRewardOptions: ForestCustomizationOption<ForestFeaturedReward>[];
export const defaultForestPreferences: ForestPreferences;
export function getForestCustomizationCatalog(completedTrees: number): {
  themes: Array<ForestCustomizationOption<ForestIslandTheme> & { unlocked: boolean; remainingTrees: number }>;
  accents: Array<ForestCustomizationOption<ForestCottageAccent> & { unlocked: boolean; remainingTrees: number }>;
  rewards: Array<ForestCustomizationOption<ForestFeaturedReward> & { unlocked: boolean; remainingTrees: number }>;
};
export function normalizeForestPreferences(value: unknown, completedTrees?: number): ForestPreferences;
