# Model preparation

These optional tools produce compressed display copies from unmodified source GLBs. The website itself needs no package installation.

Use Node.js 22 or later. Keep source files in a separate directory and keep the output separate from both the source directory and the published application:

```sh
npm ci
node audit.mjs /path/to/source-models
node optimize.mjs /path/to/source-models /path/to/display-models
node remove-scan-helpers.mjs /path/to/display-models /path/to/source-models
```

The final command applies only to `bronze_age_sword_oc078.glb` and `moonbrand_arming_sword.glb`. It removes annotation and scale helpers while retaining the sword mesh and its transform ancestry. Source filenames must match the collection filenames.

The pipeline uses glTF Transform 4.5.1, Meshoptimizer 1.3.0 and Sharp 0.35.5. It compresses geometry without quantization, simplification, welding or mesh joining. Base color textures use quality-90 WebP; normal and packed material textures use lossless WebP. Existing images are at most 1024 pixels along either edge, so none were resized. The 2048-pixel limit in the preparation script is a ceiling for future assets.

Validation checks geometry attributes, triangle corners/winding/order, node transforms, material factors, sampler settings and decoded data-map pixels. The two helper-cleaned scans are additionally checked directly against their original sword geometry and world transforms.

Review the generated `optimization-manifest.json`, update the published models and their credits/checksums, and run the application checks. Do not overwrite originals or replace licensed asset terms with the code license. The website vendors the matching decoder and its MIT license locally.
