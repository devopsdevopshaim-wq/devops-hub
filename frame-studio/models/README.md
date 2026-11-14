# Models that run in the browser

- `face-paint-512-v2.onnx`: AnimeGANv2 "face paint 512 v2" by bryandlee ([animegan2-pytorch](https://github.com/bryandlee/animegan2-pytorch), MIT license), as converted to ONNX by akhaliq (AnimeGANv2-ONNX). Input and output are `[1, 3, 512, 512]` floats in -1..1 (RGB). `js/offline-ai.js` runs it with onnxruntime-web in 512px tiles: no server and no internet.

The Hayao and Shinkai AnimeGAN weights are for academic and personal use only, so they are not used here.

- `style/{mosaic,candy,rain-princess,udnie}.onnx`: the fast neural style transfer networks (Johnson et al.) from PyTorch's examples (BSD-3-Clause), as published in the ONNX Model Zoo (`validated/vision/style_transfer/fast_neural_style`, opset 9). The zoo files declare a fixed 224×224 input; the networks are fully convolutional, so the input and output sizes were made dynamic (`h`, `w`) and the weights removed from the graph inputs, nothing else changed. Input `[1, 3, h, w]` RGB floats 0..255, output the same range (clamped). `js/offline-ai.js` runs them with onnxruntime-web.

- `esrgan-x2/`: the ×2 super-resolution network "esrgan-medium" x2 (an RDN, C1-D10-G64) from UpscalerJS by Kevin Scott ([npm @upscalerjs/esrgan-medium](https://www.npmjs.com/package/@upscalerjs/esrgan-medium), MIT, LICENSE beside it). A TensorFlow.js layers model, input and output RGB 0..255. `js/ai-plus.js` runs it with TensorFlow.js on WebGL (`vendor/tfjs/tf.min.js`, @tensorflow/tfjs 4.22.0, Apache-2.0) in 192 px tiles with a 10 px overlap.
- `modnet/modnet-q.onnx`: MODNet portrait matting (ZHKKKe/MODNet, Apache-2.0), the quantized ONNX export of Xenova/modnet (as packaged in npm `sts-rmbg-modnet`, Apache-2.0). Input `[1, 3, H, W]` RGB in -1..1, the short side 512 and both sides multiples of 32; output the alpha `[1, 1, H, W]` 0..1. `js/ai-plus.js` (`FS.maskPro`).

onnxruntime-web is 1.31.1 (MIT): `vendor/ort/ort.webgpu.min.js` with `ort-wasm-simd-threaded.asyncify.{mjs,wasm}`. It runs on the graphics card (WebGPU) when there is an adapter, otherwise WebAssembly. With cross-origin isolation (the desktop program sends COOP/COEP for studio.html and the scripts) it uses several threads.
