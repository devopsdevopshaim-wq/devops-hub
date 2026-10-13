"""Runtime configuration, read once from environment variables."""
import os
from dataclasses import dataclass, field


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True)
class Settings:
    api_key: str = field(default_factory=lambda: _env("GATEWAY_API_KEY"))
    public_base_url: str = field(default_factory=lambda: _env("PUBLIC_BASE_URL").rstrip("/"))
    data_dir: str = field(default_factory=lambda: _env("DATA_DIR", "/data"))

    comfyui_url: str = field(default_factory=lambda: _env("COMFYUI_URL", "http://comfyui:8188").rstrip("/"))
    comfyui_timeout_s: int = field(default_factory=lambda: int(_env("COMFYUI_TIMEOUT_S", "3600")))

    # HunyuanVideo model file names as they appear inside ComfyUI/models/*
    hunyuan_unet: str = field(default_factory=lambda: _env("HUNYUAN_UNET", "hunyuan_video_t2v_720p_bf16.safetensors"))
    hunyuan_clip_l: str = field(default_factory=lambda: _env("HUNYUAN_CLIP_L", "clip_l.safetensors"))
    hunyuan_llm: str = field(default_factory=lambda: _env("HUNYUAN_LLM", "llava_llama3_fp8_scaled.safetensors"))
    hunyuan_vae: str = field(default_factory=lambda: _env("HUNYUAN_VAE", "hunyuan_video_vae_bf16.safetensors"))

    # Seedance (ByteDance) is only offered as a hosted API (BytePlus ModelArk / Volcengine Ark).
    seedance_api_key: str = field(default_factory=lambda: _env("SEEDANCE_API_KEY"))
    seedance_base_url: str = field(
        default_factory=lambda: _env("SEEDANCE_BASE_URL", "https://ark.ap-southeast.bytepluses.com/api/v3").rstrip("/")
    )
    seedance_model: str = field(default_factory=lambda: _env("SEEDANCE_MODEL", "dreamina-seedance-2-5-260628"))
    seedance_timeout_s: int = field(default_factory=lambda: int(_env("SEEDANCE_TIMEOUT_S", "1800")))

    poll_interval_s: float = field(default_factory=lambda: float(_env("POLL_INTERVAL_S", "3")))

    @property
    def seedance_enabled(self) -> bool:
        return bool(self.seedance_api_key)


settings = Settings()
