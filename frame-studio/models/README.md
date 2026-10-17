# Models that run in the browser

- `face-paint-512-v2.onnx`: AnimeGANv2 "face paint 512 v2" by bryandlee ([animegan2-pytorch](https://github.com/bryandlee/animegan2-pytorch), MIT license), as converted to ONNX by akhaliq (AnimeGANv2-ONNX). Input and output are `[1, 3, 512, 512]` floats in -1..1 (RGB). `js/anime.js` runs it with onnxruntime-web in 512px tiles, so the studio's anime, comic and paint styles need no server and no internet once loaded.

The Hayao and Shinkai AnimeGAN weights are for academic and personal use only, so they are not used here.
