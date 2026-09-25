#!/usr/bin/env bash
# custom_nodes is a volume so nodes installed from the Manager UI survive rebuilds.
set -e
cd /opt/ComfyUI
mkdir -p custom_nodes models/diffusion_models models/text_encoders models/vae output input
if [ ! -d custom_nodes/ComfyUI-Manager ]; then
  cp -r /opt/manager custom_nodes/ComfyUI-Manager
fi
# Reinstall requirements of user-installed custom nodes (cheap when already satisfied).
for req in custom_nodes/*/requirements.txt; do
  [ -f "$req" ] && pip install -q --no-cache-dir -r "$req" || echo "warn: could not install $req"
done
python -c "import torch; print('CUDA available:', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')"
exec python main.py --listen 0.0.0.0 --port 8188 ${COMFYUI_ARGS}
