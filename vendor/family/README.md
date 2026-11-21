# Family Guard: the files it uses

The Ord Portal's Family Guard (`family.js`, © 2026 bitmap22, all rights reserved) checks pictures and films from inscriptions, and words in inscriptions and chat, in the visitor's own browser. It uses these free libraries, kept here unchanged under their own licences:

- `nsfwjs.min.js`, `model.min.js`, `group1-shard1of1.min.js`: [NSFWJS](https://github.com/infinitered/nsfwjs) 4.4.0 by Infinite Red, with its MobileNetV2 model. MIT licence: `LICENSE-nsfwjs.txt`. The bundle includes [TensorFlow.js](https://github.com/tensorflow/tfjs) by Google, Apache License 2.0: `LICENSE-tensorflowjs.txt`.
- `tf-core.min.js`, `tf-backend-wasm.min.js`, `tfjs-backend-wasm.wasm`, `tfjs-backend-wasm-simd.wasm`: [TensorFlow.js](https://github.com/tensorflow/tfjs) 4.22.0 core and its WebAssembly engine by Google, Apache License 2.0: `LICENSE-tensorflowjs.txt`. (Added 21 Nov 2026: the picture checker works on the device's main processor with these, so a game keeps its graphics chip.) The `.wasm` files are built with [XNNPACK](https://github.com/google/XNNPACK) (BSD licence), [pthreadpool](https://github.com/google/pthreadpool) (BSD licence), [FP16](https://github.com/Maratyszcza/FP16) and [FXdiv](https://github.com/Maratyszcza/FXdiv) (MIT licence): `LICENSE-wasm-parts.txt`.
- `words.min.js`: [AllProfanity](https://github.com/ayush-jadaun/AllProfanity) 2.4.0 by Ayush Jadaun, built for the browser (English list). MIT licence: `LICENSE-allprofanity.txt`.
- `words-plus.js` (added 21 Nov 2026) is the Ord Portal's own layer on top of that list (© 2026 bitmap22, all rights reserved): it turns fancy, look-alike and hidden characters back into plain letters, undoes number swaps and stretched letters, joins spaced-out letters, adds terms the list lacks and lets through harmless phrases the list gets wrong. The list itself is kept unchanged.

Nothing is sent anywhere: every check runs on the visitor's own device.
