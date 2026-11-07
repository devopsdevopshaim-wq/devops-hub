#!/usr/bin/env sh
# Builds index.html (standalone page) from app.html (the artifact source, which has no <html>/<head>/<body>).
set -e
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>[hidden]{display:none!important}img{max-width:100%%}</style>\n'
  sed -n '1,/^<\/style>$/p' app.html
  printf '</head>\n<body>\n'
  sed -n '/^<\/style>$/,$p' app.html | sed '1d'
  printf '</body>\n</html>\n'
} > index.html
echo "built index.html"
