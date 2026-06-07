#!/bin/bash

# Script cepat - hanya buka URL (asumsi app sudah running)
xdg-open "http://10.9.23.205:3019" 2>/dev/null || open "http://10.9.23.205:3019" 2>/dev/null || echo "Buka: http://10.9.23.205:3019"
