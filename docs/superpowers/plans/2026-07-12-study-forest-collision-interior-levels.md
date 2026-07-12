# Study Forest Collision, Cottage, and Level Preview Plan

## Goal

Make the low-poly Study Forest feel explorable and rule-based: the avatar stays on walkable ground, uses the bridge to cross the river, can enter a cozy cottage interior, and can see the next attendance-streak upgrade.

## Implementation

1. Add deterministic client navigation helpers for blocked regions and bridge waypoint routing.
2. Apply those helpers to keyboard, touch, idle walking, and raycast targets.
3. Add island/interior scene state with an interactive cottage door and accessible enter/exit buttons.
4. Build the cottage interior from original Three.js primitives without external models or textures.
5. Add deterministic 1/3/5/7-day milestone copy and a responsive next-level roadmap.
6. Verify helper behavior, TypeScript/build output, desktop/mobile layout, water blocking, bridge routing, and cottage transitions.

## Non-goals

- No physics engine, persistent player position, inventory, furniture editing, or Supabase changes.
- No copied game assets or external model downloads.
