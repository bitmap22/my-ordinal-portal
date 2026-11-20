# Draco 3D mesh decoder (for glTF)

`draco_wasm_wrapper_gltf.js` and `draco_decoder_gltf.wasm` are Google's Draco decoder, version 1.5.7, unchanged, from
https://github.com/google/draco (javascript/; the same files as the `draco3dgltf` npm package).

Licence: Apache License 2.0 (`LICENSE-draco.txt`). © Google LLC and the Draco authors.

Agent Blockhall and Doge Cube load them only when a 3D model inscription is squeezed with Draco (KHR_draco_mesh_compression), to turn
its squeezed numbers back into shapes before drawing it into a picture. Nothing from the inscription runs.
