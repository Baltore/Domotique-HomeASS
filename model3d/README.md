# model3d — from a Sweet Home 3D plan to a live 3D plan

```text
plan.sh3d ──ExportObj.java──► export.obj/.mtl ──build_glb.py──► maison.glb + pieces.json ──hotspots.py (+ config)──► scene.json
```

The card (`maison-3d-live.js`) loads `maison.glb` and `scene.json` plus three.js r128 and its `GLTFLoader` (not included in this repository).
This page explains what each stage does and why; the code is the reference.

## `ExportObj.java` — headless OBJ export

Uses the application's own exporter (the one behind *3D view → Export to OBJ format*, all levels), called through Sweet Home 3D's jars so no window is needed.
Optionally lowers some pieces for the export only (the plan is untouched) — used to reduce tall cabinets that hide the view.

* The Microsoft-Store build registers a few singletons at start-up (furniture catalog importer, log and system utilities);
  `ExportObj` replaces them with empty proxies so the exporter can run headless. Other builds don't need that (the proxies are harmless).
* It opens the `.sh3d` with the application's loader (Java deserialisation, same as the application itself), so it only makes sense for plans you made or trust.

## `build_glb.py` — a clean, light glTF

* one glTF node per **level** (`RDC`, `ETAGE1`, `ETAGE2`…; the level of a wall or room is deduced from the level elevations of the plan);
* one node per **wall** (`W<id>`) so the card can lower the exterior walls that hide the floor shown (cut height configurable, default 115 cm);
* doors / windows follow their wall; ceilings and ceiling spots are dropped;
* furniture merged per (level, material) and **decimated**: vertices closer than a grid cell (default 2 cm) are merged on detailed meshes, never on walls or floors — 2.1 M → 0.33 M vertices, 51 → 11.6 MB on a real 3-storey house;
* pieces named `Escalier…` are duplicated in the level above so a staircase stays visible from its arrival floor;
* writes `pieces.json` (furniture positions, level bases, wall segments) for the next stage;
* textures are only read from inside the export folder, and oversized plans are refused.

Depends on `numpy` only.

## `hotspots.py` — the scene description

Reads the plan and `pieces.json` and writes `scene.json`:

* floors (name, base height, look-at point of the camera);
* walls, with `ext` (exterior) found by a ray test from each wall's midpoint;
* floor samples used at run time to decide which walls hide the displayed floor;
* one **room hotspot per area** (button position + light position);
* **device hotspots**, matched to pieces of furniture by name (regular expression).

The entity ids behind the device panels and the script called by the room buttons come from a small JSON config (`config.example.json` shows the shape), so the plan itself carries no home-automation identifiers.

## Demo model

The screenshots of the floors in this repository come from a small generated 3-level house with the same structure (no real plan), not from the actual house.
