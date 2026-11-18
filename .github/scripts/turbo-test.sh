#!/usr/bin/env bash
# Tries fast image models for the desktop program's local engine on 6 GB cards (SDXL Turbo / Lightning) with stable-diffusion.cpp:
# the engine's help (for its exact flags), then each model on a few event photos with a few looks, photo-to-photo, with timings.
# Results (pictures, help, log) go to $OUT. Runs on a GitHub runner (CPU; the timings are for comparison, a graphics card is faster).
set -u
OUT="$1"; W="$RUNNER_TEMP/turbo"; mkdir -p "$OUT" "$W"; cd "$W"
log() { echo "$*" | tee -a "$OUT/log.txt"; }
# the engine: the newest Linux CPU build
URL=$(curl -s -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest | python3 -c "import json,sys; d=json.load(sys.stdin); print([a['browser_download_url'] for a in d['assets'] if 'Linux' in a['name'] and a['name'].endswith('x86_64.zip')][0])")
log "engine: $URL"; curl -sL -o sd.zip "$URL" && unzip -q -o sd.zip -d sd; BIN=$(find sd -name 'sd-cli' -o -name 'sd' -type f | head -1); chmod +x "$BIN" sd/*/* 2>/dev/null
export LD_LIBRARY_PATH="$(dirname "$BIN"):${LD_LIBRARY_PATH:-}"
"$BIN" -h > "$OUT/help.txt" 2>&1; log "help: $(wc -l < "$OUT/help.txt") lines"
grep -i -E "init|strength|-i,|--image|ref|steps|cfg|sampl|schedul|type" "$OUT/help.txt" | head -60 >> "$OUT/log.txt"
# the models: picked by listing each repo
pick() { curl -s "https://huggingface.co/api/models/$1" | python3 -c "import json,sys; d=json.load(sys.stdin); f=[s['rfilename'] for s in d.get('siblings',[]) if s['rfilename'].endswith('.safetensors') and '/' not in s['rfilename']]; f.sort(key=lambda x: (('fp16' not in x), len(x))); print(f[0] if f else '')"; }
declare -A REPO=( [turbo]=stabilityai/sdxl-turbo [lightning]=Lykon/dreamshaper-xl-lightning )
for M in turbo lightning; do
  F=$(pick "${REPO[$M]}"); log "model $M: ${REPO[$M]} / $F"
  [ -n "$F" ] && curl -sL -o "$M.safetensors" "https://huggingface.co/${REPO[$M]}/resolve/main/$F"; ls -la "$M.safetensors" | tee -a "$OUT/log.txt"
done
# looks (descriptive prompts, as SDXL wants them)
declare -A LOOK=(
  [anime]="anime illustration of the same people, clean line art, cel shading, vibrant colors, detailed faces, studio anime film still"
  [hero]="the same people as superheroes in colorful superhero costumes with capes, dramatic cinematic light, comic movie poster, detailed faces"
  [oil]="classical oil painting of the same people, rich brush strokes, warm museum lighting, detailed faces"
  [pixar]="3d animated movie still of the same people, pixar style, soft lighting, detailed expressive faces" )
NEG="deformed face, distorted, extra people, blurry, lowres, bad anatomy, text, watermark"
for IMG in ../../frame-studio/media/real/barmitzvah-1.webp ../../frame-studio/media/real/company-1.webp; do :; done
cp "$GITHUB_WORKSPACE/frame-studio/media/real/barmitzvah-1.webp" a.webp; cp "$GITHUB_WORKSPACE/frame-studio/media/real/company-1.webp" b.webp
for P in a b; do ffmpeg -v error -y -i $P.webp -vf "scale=768:-16" $P.png; done
run() {   # model, photo, look, steps, cfg, strength
  local M=$1 P=$2 L=$3 S=$4 C=$5 ST=$6 o="$OUT/$1-$2-$3.png" t0 t1
  t0=$(date +%s)
  "$BIN" -m "$M.safetensors" -p "${LOOK[$L]}" -n "$NEG" -i "$P.png" --strength "$ST" --steps "$S" --cfg-scale "$C" --sampling-method euler_a -W 768 -H "$(python3 -c "from PIL import Image; im=Image.open('$P.png'); print(im.height//16*16)" 2>/dev/null || echo 512)" --seed 7 -o "$o" > "$OUT/run-$1-$2-$3.txt" 2>&1
  t1=$(date +%s); log "$M $P $L steps=$S cfg=$C strength=$ST -> $([ -s "$o" ] && echo ok || echo FAILED) $((t1-t0)) s"
  [ -s "$o" ] || tail -5 "$OUT/run-$1-$2-$3.txt" | tee -a "$OUT/log.txt"
}
pip install -q pillow >/dev/null 2>&1
for M in turbo lightning; do
  [ -s "$M.safetensors" ] || continue
  if [ $M = turbo ]; then S=4; C=1.0; else S=6; C=1.5; fi
  for P in a b; do for L in anime hero oil pixar; do run $M $P $L $S $C 0.6; done; done
done
ls -la "$OUT" | tee -a "$OUT/log.txt"
