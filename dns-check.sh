#!/bin/bash

DOMAIN=$1
SERVER_IP="34.142.158.75"

if [ -z "$DOMAIN" ]; then
  echo "Usage: ./dns-check.sh yourdomain.com"
  exit 1
fi

echo "=============================="
echo " DNS TEST FOR: $DOMAIN"
echo "=============================="

echo ""
echo "1️⃣ Checking BIND service..."
systemctl is-active --quiet bind9 && echo "✔ bind9 is running" || echo "❌ bind9 is NOT running"

echo ""
echo "2️⃣ Checking port 53..."
ss -tulpn | grep :53 && echo "✔ Port 53 is listening" || echo "❌ Port 53 NOT listening"

echo ""
echo "3️⃣ Checking zone config..."
named-checkconf && echo "✔ named.conf OK" || echo "❌ named.conf ERROR"

ZONE_FILE="/etc/bind/zones/db.$DOMAIN"
if [ -f "$ZONE_FILE" ]; then
  named-checkzone $DOMAIN $ZONE_FILE && echo "✔ Zone file OK" || echo "❌ Zone file ERROR"
else
  echo "❌ Zone file not found: $ZONE_FILE"
fi

echo ""
echo "4️⃣ Testing local DNS resolution..."
dig @$SERVER_IP $DOMAIN +short

echo ""
echo "5️⃣ Testing public DNS (Google)..."
dig $DOMAIN @8.8.8.8 +short

echo ""
echo "6️⃣ Testing www..."
dig www.$DOMAIN @8.8.8.8 +short

echo ""
echo "7️⃣ Testing wildcard..."
dig test123.$DOMAIN @8.8.8.8 +short

echo ""
echo "=============================="
echo " DONE"
echo "=============================="
