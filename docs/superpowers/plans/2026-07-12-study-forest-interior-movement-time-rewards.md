# Study Forest Interior Movement, Rewards, and Time Plan

## Goal

Turn the cottage into a walkable reward room and make the whole Study Forest respond to attendance progress and the real local time.

## Implementation

1. Add deterministic cottage bounds, furniture collision, entrance and exit portal helpers.
2. Keep separate island and cottage avatar coordinates while sharing keyboard, touch, and click movement controls.
3. Remove the scene exit button; entering and leaving happen through the physical doorway.
4. Correct the Three.js left/right rotation mapping and keep the avatar facing the active movement segment.
5. Expand 1/3/5/7-day milestones with persistent interior unlocks: plant, bookshelf, rug/lamp, clock/trophy.
6. Render interior props conditionally from current progress and completed streak cycles.
7. Derive morning, afternoon, sunset, and night phases from local time and adjust sky, fog, sunlight, moon/stars, lanterns, window glow, and fireflies.
8. Verify helper math, source contracts, full tests, build output, and local asset delivery.

## Non-goals

- No physics engine, free camera, furniture editing, persistent player coordinates, or Supabase changes.
- No external models, textures, or copied game assets.
