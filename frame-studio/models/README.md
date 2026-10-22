# Models that run in the browser

- `face-paint-512-v2.onnx`: AnimeGANv2 "face paint 512 v2" by bryandlee ([animegan2-pytorch](https://github.com/bryandlee/animegan2-pytorch), MIT license), as converted to ONNX by akhaliq (AnimeGANv2-ONNX). Input and output are `[1, 3, 512, 512]` floats in -1..1 (RGB). `js/offline-ai.js` runs it with onnxruntime-web in 512px tiles: no server and no internet.

The Hayao and Shinkai AnimeGAN weights are for academic and personal use only, so they are not used here.

- `style/{mosaic,candy,rain-princess,udnie}.onnx`: the fast neural style transfer networks (Johnson et al.) from PyTorch's examples (BSD-3-Clause), as published in the ONNX Model Zoo (`validated/vision/style_transfer/fast_neural_style`, opset 9). The zoo files declare a fixed 224×224 input; the networks are fully convolutional, so the input and output sizes were made dynamic (`h`, `w`) and the weights removed from the graph inputs, nothing else changed. Input `[1, 3, h, w]` RGB floats 0..255, output the same range (clamped). `js/offline-ai.js` runs them with onnxruntime-web.
