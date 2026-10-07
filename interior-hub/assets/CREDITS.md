# Asset credits

3D models (from the Khronos glTF Sample Assets, https://github.com/KhronosGroup/glTF-Sample-Assets),
textures resized to 1024 px and converted to WebP with glTF Transform:

| File | Author | License |
| --- | --- | --- |
| models/GlamVelvetSofa.glb | © 2021 Wayfair, LLC (a real Wayfair product) | CC BY 4.0 |
| models/SheenChair.glb | © 2020 Wayfair, LLC | CC0 1.0 |
| models/ChairDamaskPurplegold.glb | © 2021 Wayfair | CC BY 4.0 |
| models/SheenWoodLeatherSofa.glb | © 2024 Darmstadt Graphics Group GmbH | CC BY 4.0 |
| models/DiffuseTransmissionPlant.glb | © 2024 Darmstadt Graphics Group GmbH | CC BY 4.0 |
| models/GlassVaseFlowers.glb | Public domain | CC0 1.0 |

HDR environments `hdri/apartment.exr` and `hdri/city.exr`: Poly Haven (CC0), in the 512 px
EXR versions published by @pmndrs/assets.

Wood floor photographs `textures/hardwood2_*.jpg`: three.js examples (MIT).

## Rendering libraries

- three-gpu-pathtracer 0.0.23 and three-mesh-bvh 0.7.6 by Garrett Johnson, MIT license (`vendor/*.LICENSE`). Used for the photoreal still.
- three.js post-processing (EffectComposer, GTAOPass, OutputPass), MIT license.

## Furniture cut from rendering scenes

Single pieces were cut out of full room scenes with glTF Transform (centred, faced forward, textures resized to WebP) for the 3D tour. Sources are the glTF conversions in gkjohnson/3d-demo-data.

| File | Piece | Scene | Author | License |
| --- | --- | --- | --- | --- |
| bed_double.glb, nightstand_lamp.glb, wardrobe.glb, dresser_mirror.glb, pendant_dome.glb | bed, nightstand with lamp, wardrobe, dresser with mirror, glass chandelier | Bedroom | SlykDrako | CC0 |
| sofa_linen.glb, table_round.glb, plant_pot.glb, painting.glb | linen sofa, round pedestal table, potted fern, framed print | The Grey & White Room | Wig42 | CC BY 3.0 |
| armchair_leather.glb, floor_lamp.glb, coffee_table.glb, bookcase_low.glb | leather armchair, floor lamp, coffee table, bookcase | The White Room | Jay-Artist | CC BY 3.0 |
| chair_ladder.glb, table_rustic.glb | kitchen chair, oak dining table | Country Kitchen | Jay-Artist | CC BY 3.0 |
| chair_shell.glb | white shell chair | The Breakfast Room | Wig42 | CC BY 3.0 |
| chair_tub.glb, table_slab.glb | black shell chair, glass dining table | Dining room (Blendswap) | MaTTeSr | CC BY 3.0 |
| bathtub.glb, vanity_double.glb | clawfoot bathtub, double vanity | Contemporary Bathroom | Mareck | CC0 |

Scenes collected in Benedikt Bitterli's rendering resources (https://benedikt-bitterli.me/resources/) and on Blendswap. CC BY 3.0: https://creativecommons.org/licenses/by/3.0/

## Room images

`assets/renders/<style>-<room>.jpg` are rendered by this site's own 3D engine from a sample plan, with the models above.
