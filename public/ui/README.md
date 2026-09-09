# Obsidian gold HUD

`obsidian-gold-atlas.png` is the original 1448 × 1086 PNG supplied by the user
on 2026-09-10, from `97ac0523-8d0b-4bc3-9f5a-ea780ba65474.png`.
The companion screenshot `8f998beb-de7c-452f-99ad-1508319402d9.png` is the
layout reference and is not used as a static overlay of the game.

The active theme uses the user's replacement text-free atlases:

- `obsidian-frames.png`: `9ca3128d-66fd-4b78-b74a-28b6c2d677c3.png`.
- `obsidian-icons.png`: `c4557b89-1542-4184-876f-a136d407cad8.png`.

Both are original 1448 × 1086 images. `app/hud-art.tsx` selects parts with SVG
viewBoxes and clips overflow to each part. There are no masks, painted-label
cover-ups, or extra background shapes. The status frame is a single image;
live rank, title and meters are aligned to its original compartments.
All labels, HP, stamina, rank and bindings remain live HTML. Guidance flows in
a left-hand rail; targets and interaction hints occupy the right side.
The atlases are cached and reused by all controls. The earlier atlas is retained
as a source reference but is no longer loaded by the HUD.
