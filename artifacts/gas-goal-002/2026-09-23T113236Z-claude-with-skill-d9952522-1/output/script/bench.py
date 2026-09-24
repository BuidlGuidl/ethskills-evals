#!/usr/bin/env python3
"""Measure real Base gas for payout strategies.

Sends actual transactions against an anvil fork of Base and reads `gasUsed`
off the receipts, so the numbers are directly comparable to the on-chain
receipts we sampled from mainnet Base.

Two recipient populations are measured separately, because they differ by the
~19.2k gas of a zero -> nonzero SSTORE and a real payout book is a mix:
  cold : address has never held the token (zero balance slot)
  warm : repeat payee, already holds a nonzero balance
"""
import hashlib, json, subprocess, sys

RPC = "http://127.0.0.1:8546"
USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
WHALE = "0x498581fF718922c3f8e6A244956aF099B2652b2b"
PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
AMOUNT = 5_000_000  # 5 USDC


def sh(*args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        raise RuntimeError(" ".join(args)[:200] + "\n" + (r.stderr or r.stdout)[-1500:])
    return r.stdout.strip()


def rpc(method, *params):
    return json.loads(sh("cast", "rpc", method, *params, "--rpc-url", RPC))


def send(to, sig, *args, gas_limit=None, frm=None):
    cmd = ["cast", "send", to, sig, *map(str, args), "--rpc-url", RPC]
    cmd += ["--from", frm, "--unlocked"] if frm else ["--private-key", PK]
    if gas_limit:
        cmd += ["--gas-limit", str(gas_limit)]
    out = sh(*cmd, "--json")
    return json.loads(out)["transactionHash"]


def gas_used(txhash):
    return int(rpc("eth_getTransactionReceipt", txhash)["gasUsed"], 16)


def addr(tag):
    return "0x" + hashlib.sha256(tag.encode()).hexdigest()[:40]


def pack(recipients, amount=AMOUNT):
    return "0x" + "".join(a[2:] + "%022x" % amount for a in recipients)


def main():
    me = sh("cast", "wallet", "address", PK)
    rpc("anvil_impersonateAccount", WHALE)
    rpc("anvil_setBalance", WHALE, hex(10**18))
    send(USDC, "transfer(address,uint256)", me, 10_000_000 * 10**6, frm=WHALE)

    batcher = json.loads(sh(
        "forge", "create", "src/PayoutBatcher.sol:PayoutBatcher",
        "--rpc-url", RPC, "--private-key", PK, "--broadcast", "--json",
        "--constructor-args", USDC, me))["deployedTo"]
    send(batcher, "setRelayer(address,bool)", me, "true")
    send(USDC, "transfer(address,uint256)", batcher, 5_000_000 * 10**6)
    print(f"batcher deployed at {batcher}\n")

    results = {}

    # ---- baseline: one tx per transfer -------------------------------------
    for pop in ("cold", "warm"):
        gs = []
        for i in range(10):
            a = addr(f"base-{pop}-{i}")
            if pop == "warm":
                send(USDC, "transfer(address,uint256)", a, AMOUNT)  # pre-seed
            gs.append(gas_used(send(USDC, "transfer(address,uint256)", a, AMOUNT)))
        results[f"baseline/{pop}"] = sum(gs) // len(gs)
        print(f"baseline  {pop:4}  gasUsed/transfer = {results[f'baseline/{pop}']}")
    print()

    # ---- batched -----------------------------------------------------------
    for pop in ("cold", "warm"):
        for n in (10, 25, 50, 100, 200, 400):
            rs = [addr(f"b-{pop}-{n}-{i}") for i in range(n)]
            if pop == "warm":
                send(batcher, "batchTransferPacked(bytes)", pack(rs))  # pre-seed
            g = gas_used(send(batcher, "batchTransferPacked(bytes)", pack(rs)))
            results[f"batch/{pop}/{n}"] = g / n
            print(f"batch {pop:4} n={n:<4} total={g:<10} per transfer = {g/n:.0f}")
        print()

    json.dump(results, open("bench-results.json", "w"), indent=2)
    print("wrote bench-results.json")


if __name__ == "__main__":
    main()
