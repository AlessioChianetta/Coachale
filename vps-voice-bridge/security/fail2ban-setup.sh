#!/bin/bash
# ============================================
# Fail2ban Setup for FreeSWITCH SIP Protection
# ============================================
#
# COSA FA:
# - Installa fail2ban
# - Configura un filtro che legge i log di FreeSWITCH
# - Banna automaticamente gli IP che sbagliano l'autenticazione SIP
#   (3 tentativi falliti = ban per 1 ora)
# - I recidivi (6 tentativi in 24 ore) vengono bannati per 24 ore
#
# IL TUO ZOIPER NON VIENE TOCCATO:
# - Tu hai le credenziali giuste, quindi non fallisci mai l'autenticazione
# - fail2ban banna solo chi prova credenziali sbagliate
#
# COME USARLO:
#   chmod +x fail2ban-setup.sh
#   sudo ./fail2ban-setup.sh
#
# ============================================

set -e

echo "╔═══════════════════════════════════════════════════╗"
echo "║  Fail2ban Setup - FreeSWITCH SIP Protection       ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Install fail2ban
echo "📦 Installing fail2ban..."
apt-get update -qq
apt-get install -y -qq fail2ban

# Check if FreeSWITCH logs exist
FS_LOG="/var/log/freeswitch/freeswitch.log"
DOCKER_FS_LOG=""

if [ -f "$FS_LOG" ]; then
    echo "✅ FreeSWITCH log found at $FS_LOG"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q freeswitch; then
    echo "🐳 FreeSWITCH running in Docker, checking log location..."
    DOCKER_FS_LOG=$(docker inspect freeswitch --format='{{range .Mounts}}{{if eq .Destination "/var/log/freeswitch"}}{{.Source}}{{end}}{{end}}' 2>/dev/null || echo "")
    if [ -n "$DOCKER_FS_LOG" ] && [ -d "$DOCKER_FS_LOG" ]; then
        FS_LOG="${DOCKER_FS_LOG}/freeswitch.log"
        echo "✅ Docker FreeSWITCH log at $FS_LOG"
    else
        echo "⚠️  Trovato FreeSWITCH Docker ma log non mappato."
        echo "   Assicurati di mappare /var/log/freeswitch nel docker-compose."
        echo "   Esempio: volumes: - ./freeswitch-logs:/var/log/freeswitch"
        FS_LOG="/var/log/freeswitch/freeswitch.log"
        echo "   Usando path di default: $FS_LOG"
    fi
else
    echo "⚠️  FreeSWITCH log non trovato. Usando path di default: $FS_LOG"
    echo "   Se FreeSWITCH è in Docker, assicurati di mappare i log."
fi

# Copy filter
echo "📝 Installing fail2ban filter..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp "${SCRIPT_DIR}/fail2ban/freeswitch.conf" /etc/fail2ban/filter.d/freeswitch.conf

# Create jail with correct log path
echo "🔧 Installing fail2ban jail..."
sed "s|logpath.*=.*|logpath  = ${FS_LOG}|" "${SCRIPT_DIR}/fail2ban/freeswitch-jail.conf" > /etc/fail2ban/jail.d/freeswitch.conf

# Restart fail2ban
echo "🔄 Restarting fail2ban..."
systemctl enable fail2ban
systemctl restart fail2ban

# Check status
echo ""
echo "✅ Fail2ban status:"
echo "═══════════════════════════════════"
fail2ban-client status
echo ""
echo "FreeSWITCH jail status:"
fail2ban-client status freeswitch 2>/dev/null || echo "   (jail will activate when FreeSWITCH logs start)"

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  ✅ Fail2ban attivo!                              ║"
echo "║                                                   ║"
echo "║  Regole:                                          ║"
echo "║  - 3 auth fallite in 5 min = ban 1 ora            ║"
echo "║  - 6 auth fallite in 24 ore = ban 24 ore          ║"
echo "║                                                   ║"
echo "║  Comandi utili:                                   ║"
echo "║  fail2ban-client status freeswitch                ║"
echo "║  fail2ban-client set freeswitch unbanip IP        ║"
echo "║  tail -f /var/log/fail2ban.log                    ║"
echo "╚═══════════════════════════════════════════════════╝"
