#!/usr/bin/env python3
"""Per-request subscription check for the API backend.

Calls `isSubscribed(address)` on the WeatherBilling contract with a plain
JSON-RPC `eth_call` — read-only, costs no gas, works against any public RPC
(Base: https://mainnet.base.org). Python stdlib only; drop next to your API
code and call `is_subscribed()` in your request handler.

  from check_subscribed import is_subscribed
  if not is_subscribed(customer_address):
      return 402  # or whatever your "pay me" response is

Behavior notes:
  - Short in-process TTL cache (CACHE_TTL seconds) so hot customers don't
    hammer the RPC on every request. Set 0 to disable.
  - On RPC failure this RAISES. Decide your policy at the call site: failing
    closed (treat errors as "not subscribed") is the safe default for a
    paid API; failing open leaks free service during RPC outages.
  - Map your API keys to customer addresses in your own database; the
    contract only knows addresses.

Env vars:
  RPC_URL           e.g. https://mainnet.base.org
  BILLING_ADDRESS   the deployed WeatherBilling address
"""

import json
import os
import sys
import time
import urllib.request

RPC_URL = os.environ.get("RPC_URL", "https://mainnet.base.org")
BILLING_ADDRESS = os.environ.get("BILLING_ADDRESS", "")
CACHE_TTL = 10  # seconds

# bytes4(keccak256("isSubscribed(address)")) — verify with:
#   cast sig "isSubscribed(address)"
_SELECTOR = "0xb92ae87c"

_cache: dict[str, tuple[float, bool]] = {}


def is_subscribed(address: str) -> bool:
    """True if `address` currently has paid-for coverage."""
    if not BILLING_ADDRESS:
        raise RuntimeError("set BILLING_ADDRESS env var")
    addr = address.lower().removeprefix("0x")

    now = time.monotonic()
    hit = _cache.get(addr)
    if hit is not None and now - hit[0] < CACHE_TTL:
        return hit[1]

    # eth_call calldata: selector + 32-byte left-padded address
    data = _SELECTOR + "0" * 24 + addr
    payload = json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": BILLING_ADDRESS, "data": data}, "latest"],
    }).encode()
    req = urllib.request.Request(
        RPC_URL, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=5) as resp:
        result = json.load(resp)

    if "error" in result:
        raise RuntimeError(f"RPC error: {result['error']}")
    raw = result.get("result", "0x")
    subscribed = raw != "0x" and int(raw, 16) == 1

    _cache[addr] = (now, subscribed)
    return subscribed


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(f"usage: {sys.argv[0]} <customer address>")
    print(is_subscribed(sys.argv[1]))
