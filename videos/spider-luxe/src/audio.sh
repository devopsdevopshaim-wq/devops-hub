#!/bin/sh
# Narration + score for both cuts.  run from videos/spider-luxe: sh src/audio.sh
set -e
TMP=${TMPDIR:-/tmp}/spider-audio; mkdir -p "$TMP"
python3 src/vo.py "$TMP"
cp "$TMP/vo_en.json" assets/audio/vo_en.json
python3 src/score.py "$TMP/score_en.wav" en "$TMP/vo_en.json"
python3 src/score.py "$TMP/score_he.wav" he
ffmpeg -y -loglevel error -i "$TMP/score_en.wav" -i "$TMP/vo_en.wav" -filter_complex \
  "[1:a]aresample=48000,pan=stereo|c0=c0|c1=c0,volume=2.6[v];[0:a]volume=0.62[m];[m][v]amix=inputs=2:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.2:LRA=9[o]" \
  -map "[o]" -c:a aac -b:a 256k assets/audio/mix-en.m4a
ffmpeg -y -loglevel error -i "$TMP/score_he.wav" -af "loudnorm=I=-14:TP=-1.2:LRA=9" -c:a aac -b:a 256k assets/audio/score-he.m4a
echo audio done
