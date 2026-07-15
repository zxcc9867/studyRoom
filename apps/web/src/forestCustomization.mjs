export const forestThemeOptions = [
  { id: "spring", label: "봄빛 정원", description: "밝은 초록과 맑은 하늘", requiredTrees: 0 },
  { id: "harvest", label: "수확의 숲", description: "황금빛 잔디와 따뜻한 흙길", requiredTrees: 1 },
  { id: "moonlight", label: "달빛 숲", description: "푸른 밤빛과 은은한 물결", requiredTrees: 2 },
];

export const cottageAccentOptions = [
  { id: "mint", label: "민트", color: "#69a783", requiredTrees: 0 },
  { id: "coral", label: "코랄", color: "#d86f51", requiredTrees: 1 },
  { id: "honey", label: "허니", color: "#d9a441", requiredTrees: 2 },
];

export const featuredRewardOptions = [
  { id: "none", label: "비워두기", description: "섬의 기본 풍경을 즐겨요.", requiredTrees: 0 },
  { id: "birdhouse", label: "새집", description: "첫 완성 나무와 함께 작은 새집이 열려요.", requiredTrees: 1 },
  { id: "picnic", label: "피크닉", description: "두 번째 완성 나무가 포근한 피크닉을 열어요.", requiredTrees: 2 },
  { id: "campfire", label: "모닥불", description: "세 번째 완성 나무가 저녁 모닥불을 밝혀요.", requiredTrees: 3 },
];

export const defaultForestPreferences = {
  islandTheme: "spring",
  cottageAccent: "mint",
  featuredReward: "none",
};

export function getForestCustomizationCatalog(completedTrees) {
  const safeTreeCount = Math.max(0, Math.floor(Number(completedTrees) || 0));
  const withUnlock = (option) => ({
    ...option,
    unlocked: safeTreeCount >= option.requiredTrees,
    remainingTrees: Math.max(0, option.requiredTrees - safeTreeCount),
  });

  return {
    themes: forestThemeOptions.map(withUnlock),
    accents: cottageAccentOptions.map(withUnlock),
    rewards: featuredRewardOptions.map(withUnlock),
  };
}

export function normalizeForestPreferences(value, completedTrees = 0) {
  const catalog = getForestCustomizationCatalog(completedTrees);
  const selectUnlocked = (options, candidate, fallback) =>
    options.some((option) => option.id === candidate && option.unlocked) ? candidate : fallback;

  return {
    islandTheme: selectUnlocked(catalog.themes, value?.islandTheme ?? value?.island_theme, defaultForestPreferences.islandTheme),
    cottageAccent: selectUnlocked(catalog.accents, value?.cottageAccent ?? value?.cottage_accent, defaultForestPreferences.cottageAccent),
    featuredReward: selectUnlocked(catalog.rewards, value?.featuredReward ?? value?.featured_reward, defaultForestPreferences.featuredReward),
  };
}
