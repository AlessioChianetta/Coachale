#!/bin/bash
# ============================================
# UFW Firewall Setup for Alessia Voice Bridge VPS
# ============================================
#
# COSA FA QUESTO SCRIPT:
# - Blocca TUTTO il traffico in entrata di default
# - Apre solo le porte necessarie:
#   - SSH (22) per gestione remota
#   - SIP (5060 UDP) per Zoiper e trunk SIP
#   - RTP (16384-32768 UDP) per l'audio delle chiamate
#   - HTTP/HTTPS (80, 443) se hai un reverse proxy
# - La porta 9090 (bridge Node) resta CHIUSA dall'esterno
#   perché FreeSWITCH si connette via localhost
#
# COME USARLO:
#   chmod +x ufw-setup.sh
#   sudo ./ufw-setup.sh
#
# ============================================

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║  UFW Firewall Setup - Alessia Voice Bridge VPS    ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Reset UFW
echo "🔄 Resetting UFW rules..."
ufw --force reset

# Default policies: block everything incoming, allow outgoing
echo "🛡️  Setting default policies..."
ufw default deny incoming
ufw default allow outgoing

# SSH - SEMPRE aperta (altrimenti ti chiudi fuori!)
echo "🔑 Allowing SSH (port 22)..."
ufw allow 22/tcp comment 'SSH'

# SIP - per Zoiper e trunk SIP (protetta da fail2ban)
echo "📞 Allowing SIP (port 5060 UDP)..."
ufw allow 5060/udp comment 'SIP - Zoiper and trunk'

# SIP TLS (opzionale, se usi SIP sicuro)
echo "🔒 Allowing SIP TLS (port 5061 TCP)..."
ufw allow 5061/tcp comment 'SIP TLS'

# RTP - range di porte per audio delle chiamate
echo "🎵 Allowing RTP media (16384-32768 UDP)..."
ufw allow 16384:32768/udp comment 'RTP media'

# HTTP/HTTPS - solo se hai un reverse proxy (Nginx/Caddy)
# Decommenta se necessario:
# echo "🌐 Allowing HTTP/HTTPS..."
# ufw allow 80/tcp comment 'HTTP'
# ufw allow 443/tcp comment 'HTTPS'

# NOTA: Port 9090 (Voice Bridge) NON viene aperta!
# FreeSWITCH si connette via ws://127.0.0.1:9090
# Nessuno dall'esterno deve raggiungerla

echo ""
echo "⚠️  NOTA: Porta 9090 (Voice Bridge) NON aperta dall'esterno"
echo "   FreeSWITCH si connette localmente via 127.0.0.1"
echo ""

# Enable UFW
echo "🚀 Enabling UFW..."
ufw --force enable

# Show status
echo ""
echo "✅ UFW configurato! Status attuale:"
echo "═══════════════════════════════════"
ufw status verbose

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  ✅ Firewall attivo!                              ║"
echo "║                                                   ║"
echo "║  Porte aperte:                                    ║"
echo "║  - 22/tcp    SSH                                  ║"
echo "║  - 5060/udp  SIP (Zoiper + trunk)                 ║"
echo "║  - 5061/tcp  SIP TLS                              ║"
echo "║  - 16384-32768/udp  RTP (audio)                   ║"
echo "║                                                   ║"
echo "║  Porte CHIUSE dall'esterno:                       ║"
echo "║  - 9090  Voice Bridge (solo localhost)             ║"
echo "║                                                   ║"
echo "║  Protezione SIP: fail2ban (vedi setup separato)   ║"
echo "╚═══════════════════════════════════════════════════╝"
