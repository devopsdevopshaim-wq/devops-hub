# ComfyUI with native HunyuanVideo support. CUDA 12.8 wheels cover RTX 20xx through RTX 50xx (Blackwell).
FROM pytorch/pytorch:2.8.0-cuda12.8-cudnn9-runtime

ARG COMFYUI_REF=v0.37.2
ARG MANAGER_REF=4.3

RUN apt-get update && apt-get install -y --no-install-recommends git curl ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN git clone --depth 1 --branch ${COMFYUI_REF} https://github.com/comfyanonymous/ComfyUI.git \
    && pip install --no-cache-dir -r ComfyUI/requirements.txt \
    && git clone --depth 1 --branch ${MANAGER_REF} https://github.com/Comfy-Org/ComfyUI-Manager.git /opt/manager \
    && pip install --no-cache-dir -r /opt/manager/requirements.txt

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /opt/ComfyUI
EXPOSE 8188
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s CMD curl -sf http://127.0.0.1:8188/system_stats || exit 1
ENTRYPOINT ["/entrypoint.sh"]
