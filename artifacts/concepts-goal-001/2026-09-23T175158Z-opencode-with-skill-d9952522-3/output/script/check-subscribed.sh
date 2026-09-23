#!/usr/bin/env bash
set -euo pipefail

# Usage: check-subscribed.sh <customer-address>
# Requires: cast on PATH, WEATHER_BILLING set to the deployed contract address.
# Optional: RPC_URL (defaults to Base mainnet).
# Exit codes: 0 = subscribed, 1 = not subscribed, 2 = unexpected RPC output.

: "${WEATHER_BILLING:?set WEATHER_BILLING to the deployed WeatherBilling address}"
RPC="${RPC_URL:-https://mainnet.base.org}"

user="${1:?usage: check-subscribed.sh <customer-address>}"

out=$(cast call "$WEATHER_BILLING" "isSubscribed(address)(bool)" "$user" --rpc-url "$RPC")

case "$out" in
    *true*)
        echo "subscribed"
        exit 0
        ;;
    *false*)
        echo "not subscribed"
        exit 1
        ;;
    *)
        echo "unexpected RPC output: $out" >&2
        exit 2
        ;;
esac