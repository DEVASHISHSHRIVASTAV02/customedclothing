# 3D Asset Pipeline (Phase One)

The current 360 preview uses procedural placeholder geometry to keep MVP functional.
For production visual quality, replace with GLB assets for each product:

- `shirt.glb`
- `polo-shirt.glb`
- `full-sleeve-shirt.glb`
- `hoodie.glb`
- `sweatshirt.glb`

## Requirements
- UV maps split for `front`, `back`
- Reasonable polygon budget for web (mobile-safe)
- Correct normals and material slots
- Unified scale/orientation across all five models

## Integration Target
Store models under `public/models` and update `src/components/viewer/product-360-preview.tsx` to load each GLB by `productSlug`.

## QA Checklist
- No UV stretching on print zones
- 360 orbit has no clipping in default camera bounds
- Texture color matches selected garment base color
- All print areas line up with editor export content
