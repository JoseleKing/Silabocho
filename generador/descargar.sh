#!/bin/sh
# Descarga las fuentes del léxico en generador/fuentes/ (no se guardan en el repositorio).
set -e
cd "$(dirname "$0")"
mkdir -p fuentes
cd fuentes
DIC=https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/es
FW=https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es
curl -fsSLO "$DIC/index.dic"
curl -fsSLO "$DIC/index.aff"
curl -fsSLO "$FW/es_50k.txt"
echo "Fuentes descargadas en $(pwd):"
ls -l index.dic index.aff es_50k.txt
