# Family Guard: the files it uses

The Ord Portal's Family Guard (`family.js`, © 2026 bitmap22, all rights reserved) checks pictures and films from inscriptions, and words in inscriptions and chat, in the visitor's own browser. It uses these free libraries, kept here unchanged under their own licences:

- `nsfwjs.min.js`, `model.min.js`, `group1-shard1of1.min.js`: [NSFWJS](https://github.com/infinitered/nsfwjs) 4.4.0 by Infinite Red, with its MobileNetV2 model. MIT licence: `LICENSE-nsfwjs.txt`. The bundle includes [TensorFlow.js](https://github.com/tensorflow/tfjs) by Google, Apache License 2.0: `LICENSE-tensorflowjs.txt`.
- `words.min.js`: [AllProfanity](https://github.com/ayush-jadaun/AllProfanity) 2.4.0 by Ayush Jadaun, built for the browser (English list). MIT licence: `LICENSE-allprofanity.txt`.

Nothing is sent anywhere: every check runs on the visitor's own device.
