# Executor transcript — 2026-08-27T234937Z-codex-with-skill-1

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002

## session

````text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a045a1-13ce-71a3-b4e7-5152e7ed700a
--------
user
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.

2026-08-27T23:49:39.630488Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a045a1-13ce-71a3-b4e7-5152e7ed700a.tmp-1787874579428737891: line 2547: syntax error near unexpected token `('

codex
I’ll quantify the current Base spend first, then rank practical reductions by daily and annual savings and implement the safe relayer-side changes. I’m using the gas-cost guidance skill because this request requires transaction-cost estimates and EIP-1559 policy.
exec
/bin/bash -lc "sed -n '1,240p' .agents/skills/gas/SKILL.md && printf '\\n--- files ---\\n' && rg --files -g '"'!node_modules'"' -g '"'!dist'"' | sed -n '1,200p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
---
name: gas
description: Use when quoting a gas or dollar cost for a transaction or deployment, when cost is the reason to pick mainnet over an L2, when setting EIP-1559 fee fields or cutting L2 fees, or when calling Ethereum expensive or cheap. Not for non-cost chain selection (`l2s`).
---

# Gas and Chain Cost

Your trained gas-price and ETH-price priors are stale. Never quote a transaction cost or exclude a chain for cost reasons without measuring the relevant chain now.

```bash
# Mainnet
cast base-fee --rpc-url https://ethereum-rpc.publicnode.com
cast gas-price --rpc-url https://ethereum-rpc.publicnode.com

# Example L2; query the chain actually under consideration
cast base-fee --rpc-url https://mainnet.base.org
cast gas-price --rpc-url https://mainnet.base.org
```

If an endpoint fails, try another RPC. Do not replace a failed lookup with a remembered number. Fetch ETH/USD live before quoting dollars.

Estimate the actual operation when possible. Otherwise state and justify the gas-used assumption:

```text
cost_usd = gas_used × gas_price_gwei × 1e-9 × eth_usd
```

Choose from the measured workload:

- Keep mainnet viable for low-frequency, high-value actions unless another requirement favors an L2.
- Prefer an L2 for high-frequency, low-value, latency-sensitive, or L2-native activity.
- Do not choose an L2 merely because you remember mainnet gas being expensive.

Derive EIP-1559 fee fields from the target chain immediately before submission. Do not hardcode them or port a mainnet priority-fee constant to an L2.

For L2 optimization, inspect current receipts before deciding what dominates the fee. On OP-stack chains compare `gasUsed × effectiveGasPrice` with `l1Fee`; do not import a pre-Dencun calldata-cost assumption. Other rollup families use different fee models, so measure them independently.

--- files ---
package.json
TASK.md

exec
/bin/bash -lc "sed -n '1,240p' TASK.md; printf '\\n--- package ---\\n'; sed -n '1,240p' package.json; printf '\\n--- git ---\\n'; git status --short; printf '\\n--- tools ---\\n'; command -v cast || true; command -v node || true; command -v curl || true" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.

--- package ---
{
  "name": "eval-workspace",
  "private": true
}

--- git ---

--- tools ---
/home/damu/.foundry/bin/cast
/tmp/xfs-79604968/node
/usr/bin/curl

exec
/bin/bash -lc "set -e
printf '%s\\n' '--- Base fee data ---'
cast gas-price --rpc-url https://mainnet.base.org
cast base-fee --rpc-url https://mainnet.base.org
printf '%s\\n' '--- RPC latest block ---'
curl -sS https://mainnet.base.org -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getBlockByNumber\",\"params\":[\"latest\",false]}'
printf '\\n%s\\n' '--- ETH USD ---'
curl -sS 'https://api.coinbase.com/v2/prices/ETH-USD/spot'
printf '\\n%s\\n' '--- forge ---'
command -v forge && forge --version" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 1504ms:
6000000
5000000
--- RPC latest block ---
{"jsonrpc":"2.0","result":{"baseFeePerGas":"0x4c4b40","blobGasUsed":"0x4e2b38","difficulty":"0x0","excessBlobGas":"0x0","extraData":"0x01000000640000000500000000004c4b40","gasLimit":"0x17d78400","gasUsed":"0x1e98ca1","hash":"0xa6ddd23e91fa9769c5c8861a7c56da5cf19a7c293903f3a8051ce94a0ab3273c","logsBloom":"0x606d7d6d614179d188851283ee2eb2b5b41904282e1e5d836ac607c6196221459fe8fd441c50604a1d17015989363605f7997b3ab4676974b71162a7f6be13c1b0489d90f066346d96f5c81e812195fd515d159f3f4c9afaf7ffdc60c75962453ee024a0fa4b3604173da9a02686a99959f41e166f14f438f086c557ac8f624258ee73b93e014728676e2e93c05f10e476d3a68f0a6dc858d086205e95585c793ec0106ef49032bd5f75ac000808fd683a3dcc39a010891be3c7837d56edd3a22b1210becac0e075d155cc9185b415e2162a82fa85348c7e568147e3889beb3a5d7c7ecc0d77a608b976480888a3bfb6e5ffe5f37d132b62fee084453d139f64","miner":"0x4200000000000000000000000000000000000011","mixHash":"0x7a42a6f7bcae9cb9a9b632b28aa0a2c46fb617382d9e72dd508ca5a8b124ae84","nonce":"0x0000000000000000","number":"0x3033825","parentBeaconBlockRoot":"0x5dc1af507624f271d98036521ce3be4a6c168ec51947229aaff15a8af47fe1e1","parentHash":"0xdb532f637a9064b79994539a2718c9db232abcb9a1440baeae0dac00ac19aa7c","receiptsRoot":"0xc547a3899ebea2e5f5b3968570f4721663f464477fa31ecba16dbac29d5d3c05","requestsHash":"0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347","size":"0x15672","stateRoot":"0x546a76cd4e8c703a1504fba55d8952e0f9487b682e84b038b8a8ae20d69d0d01","timestamp":"0x6a90cd2d","transactions":["0x818839e6d04e8ef23a26c1a3df2ab29806cafc23ed4cedcd0d788941815428dd","0x8936fccba4d6d4a9e5868b218401fa7d0e248a1b88c91aa2608be826aacceda9","0xc5aee74daa9586e6744ffe138b422592181a581f98e59b21336e7d6aab3c0e06","0xfe439de288497c518cd59bf6dfcc201a3c3f1a76101c827542529f8f1d254b9d","0x7327656159fb660e9b15ed739d7d10e74bdd889ac22a91ad1f46e6c6bacb5653","0x4e5d3a8c8c754fca96c228f84f4ee9e06a8bc3432deb85c25e51fc44667aae1a","0xac0898f894f1a2d49a8ca6c4201e5399db6c445bd364ef488e4ec7f8add738ea","0x120c1f5506478294fea38438d218dd8a35ca4dc5065e28be3c7fa21625d78e2f","0xe7e0eb14c00fa284b851eee3dd0a115be1d4056b7958c9e20c0d77a706ec9201","0x53bec9d2a2c86f8cf38c77c3d04bb81c20e48557398f6100d604990af04c8bfd","0x9c1fe202fd30826186eed8afc455ddf7da98802066dacbdb89fd7c197b57da74","0x361e1eba562fdd67a9166bb55173573682e610b2fa3f428ae6e7e03e94a032ea","0x11dd95b4f910859269d8b10eee13db0d3fbbdb16d19d9eec06e4c6538932c93e","0xe3a0f602e5acbdb6f75c19014468c79dfb78de446ba15e5812fa791ad0ec6cd6","0xc5c4f60ac41e3c592e7b7959c936eeeccdc177db3f1fbd19683c55030bc1a509","0xc46bcfd1a79cb61cf6e6754ace5a4ceccf5b5758dddd629885bc87b20c79fce0","0xdc4719cefa552b890fb8e6ab5acd203e5e0166807b8a9744fe1edf2b409abefe","0xc4dac0841b167a26ff3fd0e682fa7dae550db25af56c2975e615d6d4e503189a","0x6da8ba1e65262617b808bd33dde079e1fc151f8d02d646c528180142b237a21c","0x62a17d0e9eaa885778f35b09acfa96bf6cf80bb15ba03ff18cdb6267802dc250","0xef91b79b1ecd353b1f6a8c4f64ecc7988e7a834ea83dd8fd68e4b063df393bc4","0x48defb6421f72004d27afdd9773fe490c31fa67df18d054797d0b96549d22027","0x6ea862205525dd1cbf74d9866c517524eb813e8a8106f9cd2f9cc23aeeab4957","0xf3d1e04ee874cfe5ad3f719761cbd78f3a172bd8c91bed3b157832a06a0c4a66","0x91218ae1fdd284c8eeff3b9f0d317909e3d93e39ab73d7c226b31382c2bb2122","0x50be400695f3ad1590cbd715f6262f5603fde4ad3e9d9502635ac62ce288c142","0x0b88f369aa39da14a63bbc9085489c8e922abd51fa7e85deb587d2afcf48b488","0x2f81887d741678fb70d5991dc9583929c0dea60882989feeb418762e91104a0d","0xa7e98140fcdc01c31111d4efe1513e9f9c710d9dd7402c5f35f824feec1e9ae8","0x07cc4db2cb2008844ace95643661ab92c7d602f831a4569a58e886d779fb1993","0xef67c198e1a2563a17ad7443181db105d658593f9f020f74e95e9ab83a4e53b0","0x20a93cdc9984ec59a2a45d05249567ee4f07933e11e2c28ce3aae42feaf0d264","0xa8621bf13560b2af2c9f7d0df0418ad4d68a02e8154a287b257b4e722a465de4","0x6a516609bcbd04b75259743b7cb75d36f67d20abf8264042bfc758fe2ed32285","0x2268ec942e7608ccee0c32b911a6938145a3d081f162628bb23bf05e8bea2bc6","0xbe32def7b4d63a9b978449858545d39c5dd1e41ab5ee051f2fd1f24256792a1d","0xfcafeafdb000000943ffcd1a517c91b60dbbfbbc3f75df4d85cec6daf99da61e","0x594f29cad39a4604407a94640cf6fc1d099ad91db74e43f916fa61753aff020f","0xa587d6a9e1bb734063840e4275246d52c450c0f4b5f0de9b0fc26cd0c0ff6e7d","0x3588d336a12f95588127b5f87f300bae6be8b44042a5055bd787c661d5f0f8ca","0x08a4ec8a8e23417214c7a559422505ac65964ef0187e19312ddb07da8e8791b2","0x17947cbe598e441ef742a17dc8644af1dbe9f7ad687988f278def7cfdc4ddfd8","0x87bd50fc5e78545aee01ac73803ec9366ae2bae37484abd4d2d72dafe31dfaf1","0x67b8dbbbdd91d9db6e6d9890d7e3bbfc6aedd63635324617048b5f97cd999925","0x17437a9f475ba873bd9c297226a2149b847dfa815779beb800544738143397b9","0x60a02966b387b62f093dbd0c70fa98f800aa3b9a5488eb52c44b5c2ee8c021ca","0xbb901e4eb02deabcb29c3e8c8724893007d31ce6c81084bb7339ef3ffc0d24a8","0x80bdbf7d3a5bd233327b398caf57875918a24774c9e7e8a898e6126feeb59bea","0xa971d169b2ffe136853a22278ace0dfb44e718740962fafda244f96e1be58345","0x89c3c6bd13b894d50c66af33e14aef04acb84fa4828cc83ab6690dea36e467d7","0x0f4270176e81e8dbb9e0c53ecdc24a31f62b0843864e0359165b265d1acd87a3","0xe1f371c54b26997873b5d278cac667a68c53011ef6a8fdab00954b358a391f70","0x87cc001ed2de0bce2a6848fcdd31a0059718d4159da9e9aec271bdaab9084906","0x57a053ba82f1d2572e23093a920c404476f7385dd4aadcf52599e661774c48fe","0xc636569984b0405c83119c0c38daca49f2dd6624b907e8ad57c73e60f7c8702d","0x22cdb720b3c18dead4c6383347a85cc1a2b77acf9e8a0ddf2705a6c1a9336531","0x3063558d5c0f7aea09e0d5f6cd63e76ae9789c01d2c9511e28deb7f7aaf62908","0x327dd23c2b237da13d54eb138c54f5f23c120367fe5c95c2daa24a0dfa3920f4","0xfdc692da43778aac7e5d7c135f4e1997af8beafb8385e5e04610e2f3e0d05952","0xeef2b5e80787c52070645a770c805eb24755ce40ed2426c781ce28a5646dd927","0xbe0de9607640d0275c4934dbca5ab3db649ab330f9354cad5623037bd4ef199d","0x9578a6d5d9d79fc57e1d256d1bc137ff2eff447974ea13c25893fa500508f40c","0xa9b56969adc1e8e5fd1512c7f9c93de46757dec25e4a7158a513ae90f4dd743e","0xf20bd257b07d0383c18d942cb939d31f82bf43d6b2dc7af3d4e94eb042aa285c","0xdd2641c510398d831db73f4fb108c6f8ba15234136d247f71d0442b39d7452e6","0x5323c35d255d11512dfa9bc3c4f27290f34a5e9d490c757b544dcd41b66f5838","0x6b9b4bf52ee60eac5a1b20a7e16d18ff7f37fc6a501eccb09a331e682b165d84","0xc65928916c0c34fbf5c6fa28bba0e19856af6963028f3a3e44c381a743699d67","0x132d8dbc519e6a10c719a9f27ba27c93b62b19d9ea0e1165586023c8eefd4bce","0x672a90c04f1f8269114a20d99b286eb4bb0501a4cf076b7d934263d77f7b14bf","0xac6d187e073ae7da743f4b8a55164a5d872276fef16b04588d65aab4953df2c7","0x0901963fcb1d7688c4d3f79876cfe245b59e68b6bdef0e6a4d57cb290a786658","0x2f4c1293ad1918009cfb8d3bfb3f55bd20f676a38cbf567030f0c1f0e7744be1","0xfaebfab87bd88cbb3f370b5ba0ed6f976e5f63f6cc07b28983e0c3cd668f4626","0x903174278c95b01b708f0088d62d44e6bc05ad0588c890e13faf01cd4fb331d1","0x203d7917b63594ab89641a6353fd288d10415b84ad9ffa41632ef4a771917a1e","0x28eaf3dc12048e1fc5e628356f79c7e812d72aee6a3981637a7eff6f65711c9f","0x301ca80002ffb0e241db5d78be308c6a4d10aa894331531ad9df2fbb86fe96ed","0x4c4820a2fc47a027b28169ab4dfaf4a5d2dac98edef5ed68fddac0d1ae0ef3ac","0xed36c8241b34133ccea93f195044ef2cc7819f3c964a78368f2b2f9a3b2e19fa","0x9033465b4129660d4595f07cdc255e93fb21bf9d7fd7cc9435f9c1c3901db873","0xf577933868b19734b116b9540c741b6f27bc61c0df20933598e810dc70965896","0xcc647e33b6519b705562f23e574ca1f0be97c8535dabf5433075a342bc14ae25","0xc980b38e085445bd1b9659f170297b3ddc999877600c1bc91d62d10528696ab7","0x4f986858be91c5b34da8973da81d94af0aeb7bcd6cfc6796e1b15f224781bd4a","0xdf63b28f476647b65c9cb2f62686e67a5791db8abac69fe00a37bcc00183098f","0x00563584db590161249df8d5a15733e26923cb2556b0c6ebd1483f2634412472","0x89e695cadf9b18606a34f3b06aee19e2a9d7b33da15135d316e7175b1fe532a8","0x7b651e386cf527907e9c9e3e28c273657abc6cd90e6ace75bc733098be2049e0","0xb0b6877b71513894122067a413e2886ce8a40b67468e9477124ac6cbf3d19faf","0xc1e79d84d41f714f16ababad3f6c71f725c7fe0851778cb63d3d0353d72cab90","0x4a1712776e536a1b8508ff9300c82af4a0d4eade9be9b0f2645e3cb3c451b1e7","0x1d7e32e2e6705775f234e9ee02edb3624a40c10e5799646461d1855583db7ab0","0x6dae2ae69527f20cfe9559743c1968aa26ff690679049be71c4a8f8c7d3197b8","0x6fe5b62e0772f0aaab096a7e92443bd825b037665fd63f803bb5d47cc133c301","0x7e038bf5fc8859eb82ca4b0d21d58f442986ebd0d58046d1601714f5b222fbb9","0xef0995daf5d32cd153d4566d6dba94fe1d811105f5739d3d3ce7ecda36c81dc2","0xe161c92446fc8d553936a4ff060bb4b0f22620d29e1913d29ec349ab3572eb08","0x0c844c166e26cb73c7f0e465bdba295bfc6514cb3c9e69e5b672d35252f06858","0x7e15f52d16a4d309acf09d235fb0221b9db07cae5c7ead53df0aa36523be7acc","0x29e3f147f1b773fe6521c6c6986808476143b01c5a8974b2951cc0b7ef12e921","0xaa17d5713e92a827e85ab33644631d187c6f7d7843e2ac9ca5a5f8567442528d","0x76c91f4b2b601959b893b00a0eae0835f31860c9104da7cc0e6c21535d40c0c8","0x55baefa513585413872edf845cbbaeb6647fca68f2a61d62fe906c34a71a7eae","0x559a47774baa4f489ff883d42204dfb79f103066ec3c01977c244dca2493f77b","0x9a0ea728f83c81073c469c20f220d82429768dfe952f14e2f2b4fb41e7664ebc","0x90c3f0f7f427571181d82b619da62fd8254a9ea47d4bcc5a1df4a3c7f711b228","0x0da5aada18c266b5cbb07ff6348e057cedb441f0f4402a98eb4d4ad6081a6865","0xf6a4fc51ed24c0b58f69fd42afcca07d5fc8f85dbfeeb678c328cf05b18cc788","0xd2b254705746582880bf2e22fe847fb84cf0961820e64bfc8b579fb9414a4e7a","0x1abb9753f4c3e70a534dd7fbf9ebd878183dff63aa9765df855e5daf2a03bafd","0x53de43b61e5f2c1cf4764ae4080da3b57dc16c59a3a9c20cb9aa00046dbf59f3","0x6f55eaef47964a218db276e77f0bb24072fd5ce5fd647040abe29affb65c47eb","0xf0f5371259c05cd863fddd224824379664a2e46848abb502edb8abb310723975","0xd2ccc31cbea5dc620910680543d9424cd6c3a091f9323bb9fa7e7d92044ab47f","0x0745eecc48df6f6d55dddd4766890e896cfa21ec369df62e0bb2607361bb8362","0x38927b620edfc49c0a930214ee3100e836827d36d40e02762603eb0218e54c5f","0x921d02953c3aadb2b18b50c01e6d0e8b858a1504d35a7fad06abde79031bedb9","0x1e1adc491858a256a59f0902fedcf04e935d3724083bebf1ab9756fb6e7bbbe7","0xb23c983ce0e99ce24d799dd916605d3ebfeca5c5840790b666a24fd755e461a5","0xf144a9c5610be2d811883c247326bde1726a3cd22834e88042a12707ba90194c","0xafd217a38df9cc720f94afed3ec0f4255eae8550b83593754d73d9f206ddd3cf","0x1cad7f49979262d11685701e1b6c18793b0d15adf650ef07793d409d404f331e","0x56eec535568725e461df7b29bc90f0a4cfdb8ab6c1ad48690dffe863805cecbd","0x7fb6fdbd72ff622766937249aef4520fb25d05d3e5acc283b0bcafec3368d2a3","0xfd1382bab264e4b54efbbe2244594c9d19d07ee2ac2d3e7ff16798fff4e93a78","0x2d4ab58c535046cbf9ad8b8454903477d01c49c93fbda2deec9f8f6e31bb7cf8","0x5296ffd3dec66781ea5db59b41f5cc5dc8a0d7b5de89d6b61363a457ba24572b","0x9840cffb0012f20a4cd85d4580e0768f494fad52f54cf616622e43e73263f687","0x70421a6132dbd425859176316b5f7ea3a4a1cc9ba1d1c8e79419642b18e91438","0xdc20c53eff62fbceaee42a04e5af0c5fa7bd1a51207659713bf3357fbe42b94c","0x75e809be0ab4a055966faf00b8d6bcc10a9bcbd2f402490ba19de1f184580cd4","0x6ec8c6f694a13253eb3105856273c2f09ed996464d0e2bd04cacf844d73df911","0xe39c9af3f839ac2aa8e633035c061abb09c37d115c95cb522d626435be8a9c63","0x815a99221dd494afa93a0e2ae5996807e0edc4a57780c4fa2f3805d37b5b38ae","0x10aef43b7ded84ccabec896f28ca88842f1f13b1522c89b20c3fb4f8c286a8d0","0xdeb58490931fce2e88d9aba3c6cda8c928279d06f0b28487e1e56e556d2dd048","0xf02024bda7934fef49e22b29bafe332336f488df2650f853c810a7fa12ae5835","0xaf6039b86e190157066079ae8e5e7d50b79267e80e8a5ca2c0cfa58f5ba4009d","0x7a6f4e594d32ebaa083405420a2ae6cc7c8319a85700fe69a88f10af13791228","0x007d414f5b6883a17ef8d84a21c980839ab42090ea6ff026a4611427276bd20a","0x9299745dcc8e25dc83d6a2ae372ad948168e4523bcad369f4827fb1b6888f621","0x6aa02f49512097ac40f965491e5e705d204d13174025e34c4803449a5fa044c6","0x2bc37f638a1989cb2ec425c31afcbdb8bbcd102c503a3605d1647d4ffe9d3dee","0x19c51750a7e0f8673275ef7c4fd48544a9a841f5146f54796ddf19ed49376e40","0x3a67e4c94f5d165094dbf318fe94f6e45bab217f0e13eb01a9b1dbed3ad78bdb","0xece1a3d88d03d84b53770e1ce043d75d9125cf78d9c2cf3f4d321c1473b61c64","0x8ccb235b694e62235c1d4a3e12e677d55b6eae622be4facdfdf1bce097a7b46b","0xcd7aea53c86b3846f45d75d8b490bb709a0591ebac7c564837c3ef0392809986","0x41293acf742fe6c0d9763c1a7a8962c07ce94b74a6dfcd66722ba7b55e018b70","0x218196d816d324c5601a74766e5cbdc7a1eaf66a55b9ef413f2220571923bc13","0x784361c55ef67bc928c639817c693be087bacd3327967eb8301a42dd04a48033","0xfc5cc88602ae8415adb0bbdf24476ff762f90f257c8ea8acf9e02b79e68219dc","0x9f6115a26e0035de78eb7314d8c0ae497f7f561ef929d6a874f5e52fec69907a","0x7d47fa80e59070cd81e05d4a36b2b242f253920eff977d47647afca4a56f691e","0x3cc7a58049ef191b4c639d53d19075feacdc48737174a98261eac4473c4812bc","0xe95f08e3dc23a56dd6b5dcb6dbfa97734f8de7eac94814a9669eb0def9976390","0x85db4008c58c79d33c0ac35462d0241020e7db7203e0be41cf358e88f7bf0e27","0x6b4e47243e427ce44a8b1d7a93adc4231e4acd9039986d1e35bb1ca9321f01e9","0x6e4823faadd64830d750b3bf8b2f4415257c104164bd310c995ec351a357c168","0x21e5faaa2fee6d2653a81cbf19fa56f29f7a625687d4844151485198ae547388","0x7e173106ac756331b5c39fed5ee6602572e63a3bef7f3cb55146312718de36c0","0xc9a991c2a921db86df2bcaa44b0277aee9b1f8ea61dd49cae0305edf72e2d31e","0xaa0765edf8cab325da6154b060d91c0bc40f6e913735121bf9aff994a7e5130d","0x91984d2a31d1cb983781be3454031ee1a5e2e8196e37d93a1e258b73b1613f36","0x306d05aac9f0698cfb62bd7d8d9d1781dac97db1afb8e32f49b587af26edea87","0xd7f54ffc43283f3e35cc55f3133f07fa8e19a50ae99b526788d7124d0d0e79cc","0xdbd26463e03f9923fc492dc37eb04cb165faa6bf57b7322fb91dfcea51040b63","0x44f01d9bce0f871d244277f55e599f3abd0311250531855a90bfba35dddccad5","0xaed06e45c78ff9bc0e959a640988e390921d106c9e8a46d53df134350d287812","0xc65c44fae2237edb634bb8970c28acf525127690a92cefdae9f39bb41eaabbc9","0x5e2732cbacbd96177543f914fa3eb6aacf0db5dcab514f95586bd1a6e46ffb4e","0xe2d5fb9d998e1468f267a4115f6f13c6a9e0752bc7f3c8147b2dcf6e7f26e7ce","0xd92c88942ea563504fc995469cc79559f0156d1ba4aac5dd86741b4255b7cf4f","0xfb6b4a3d8ed15e9e1c307644ff5d65e6a30036e581a10c4901bf8bb267cd6ab2","0x8f23fb9140f00f52b8f4ce1a41a6c363b641730003a127878bba3698cc044ff9","0xdca4f4759950b9019e7279cd96952e3a8af243708a94191f9b46ac68729ae25a","0xb5bc92e4e5069a49d72c6deaecc2f0b68bc9ef0e553f91822a5ea1183faa9b4c","0xd9283dfa24be794ced7cf10f5b4df1f53359caa766dd1c8306fcf6a534f3b833","0x897b641568e6a9870c0990a2bfd8212dbacdf297ac2d0c079c1413b01b420153","0x92907f7a4a245dc1dd272f49b5fb7e7a6521421b00637c8f134adf9764bd3788","0x2e95120258ab943d855077abbc3dbfe5d5e4a015b6a7bb989b60c5c346cb39b1","0x5409bcf9483f1271ed68289e9c90bcbcc6caf05403aee62e3897b9ed4b14eaab","0xb020b0dbadb04cca72d12512ec871b346387671c9cc1774aeb7e8c164d15eb8e","0xe9aef5dbe47eec8eb35ac7ab0215ee3ac3927d0726390294474e324d2e5e188d","0x3e6ff004401d1fc1fc42429e98f43495cefe59232b02ac4d595f415e01732731","0x6cb67686801bf7b745bfb20ea26cb08d2015fa4cd8d16246bc3aa29ca87bb82b","0x6e5046cba8984eb03b016b3cc1e347833d405489a7162d66285247c37b2486bd","0xc696d29e0c3bc1b43e83fd6b07e26f6dfecc2a9b1c4ef897b6c9825401149430","0x6105aac50e4f1e1f961904d7e37c85c4e9b350452d5586a240f85df64e99163e","0x550b24020ad7bc4a6577191d9b5b3e59c4885b821f095c7f40088c17da6bca70","0xb54fc2622497e1a35cde665c6805cf50ea64f90e6e4a33ebfaa49a09b3a9e3ee","0xa43bf4c84213a53261b3923151e5dad91a52dfa7ed91a418a26ef22131ee49e5","0xf8a19cc02cf7929c3251d4fba423fde982dbc1c5e5cf27343f63294e781a057c","0x1ec3a9de06b1403cf720bceda8e844f28fc2308f9e4433e3b0e832836ba0aec6","0x735d428c0dd69f08eb7b94a1c87296ac28a54e8267ad4b5a30f63178a730f871","0x79380669c39dc79536354d132ed77bcd57cb9007d111b4a68e9baad7b1fc3f51","0x2d43b44893c283faeb2954da798d35c6aac09a14c5e430d7832aa6327c6bb3c9","0xad390d2b0cfa81193d7f44b5202a42a7b43f072cc8e5173c6c7e3c92170450b9","0xb4947da134323cf27ca323114850e36623a9aa552ac6f36ccdaf2bee46970cfe","0x41459683ad867f6f2b7398ac3076dc9be978e5b2bcaf0b012a34e82876d97ea0","0xb279e8a2ba79627b823c96011485b34ee2c2d251e5fa9a3623975963b866b2d5","0x9b764d1b677cd2911fda2cc22c97cdaac517323e526f0b8c9c1238fb7741c402"],"transactionsRoot":"0x7f128f0fa3d19f7331bff145f3825de5683d11c5ab4c8fbd6d81e95758e05b5b","uncles":[],"withdrawals":[],"withdrawalsRoot":"0x06c5e4eb5d0f6435617c603bafcf9fc1d52af39cf52ae11fe8d55e124a335103"},"id":1}

--- ETH USD ---
{"data":{"amount":"2511.505","base":"ETH","currency":"USD"}}
--- forge ---
/home/damu/.foundry/bin/forge
forge Version: 1.5.1-stable
Commit SHA: b0a9dd9ceda36f63e2326ce530c10e6916f4b8a2
Build Timestamp: 2025-12-22T11:39:01.425730780Z (1766403541)
Build Profile: maxperf

codex
The live Base quote is 0.006 gwei (5 mwei base fee) and ETH is $2,511.51. Since no relayer address or receipts are present, I’ll clearly separate the measured market inputs from the ERC-20 and batching assumptions, and include a script that replaces assumptions with your actual receipts.
exec
/bin/bash -lc 'set -e
recent_block=$(cast block-number --rpc-url https://mainnet.base.org)
for offset in 0 1 2 3 4; do
  block=$(printf '"'0x%x' "'$((recent_block-offset)))
  tx=$(curl -sS https://mainnet.base.org -H '"'content-type: application/json' --data \"{\\\"jsonrpc\\\":\\\"2.0\\\",\\\"id\\\":1,\\\"method\\\":\\\"eth_getBlockByNumber\\\",\\\"params\\\":[\\\""'$block'"\\\",true]}\" | jq -r '.result.transactions[] | select(.input | startswith(\"0xa9059cbb\")) | .hash' | head -n 1)
  if [ -n \""'$tx" ]; then
    echo "$tx"
    cast receipt "$tx" --rpc-url https://mainnet.base.org
    break
  fi
done' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 2904ms:
0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0

blockHash            0x9831c921c8c827d4aafa3c3815a3779458cb07368a02d3cc5d89295f1f23030e
blockNumber          50542634
contractAddress      
cumulativeGasUsed    26626646
effectiveGasPrice    6000000
from                 0x1d7f97D26ae2C01F9b01Fc252B73Cf0Db3397E95
gasUsed              45047
logs                 [{"address":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","topics":["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef","0x0000000000000000000000001d7f97d26ae2c01f9b01fc252b73cf0db3397e95","0x0000000000000000000000003cdce9661f6d8475dfdd8bc3470ae1434e6977af"],"data":"0x0000000000000000000000000000000000000000000000000000000000058200","blockHash":"0x9831c921c8c827d4aafa3c3815a3779458cb07368a02d3cc5d89295f1f23030e","blockNumber":"0x303382a","blockTimestamp":"0x6a90cd37","transactionHash":"0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0","transactionIndex":"0x3d","logIndex":"0x59c","removed":false}]
logsBloom            0x00000000000000000000080000000000000000000000000000000004000000000000000000000000000020000000100000000000000000000000000000002000000000000000000000000008000000000000000000080000000000000000000000800000008000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
root                 
status               1 (success)
transactionHash      0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0
transactionIndex     61
type                 2
blobGasPrice         
blobGasUsed          14800
to                   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
daFootprintGasScalar 148
l1BaseFeeScalar      2269
l1BlobBaseFee        2738220
l1BlobBaseFeeScalar  1055762
l1Fee                488360980
l1GasPrice           54889301
l1GasUsed            1600


apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/scripts/receipt-costs.mjs
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/src/BatchDistributor.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/test/BatchDistributor.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3566c449f03c25f6f674af11f2dba5378bcc9004
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..71e506bfa3eccda7bc6dd6c84591cd3e6258461c
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..291c982b59f8adbed7c72cbac57efc8d5d874d76
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3566c449f03c25f6f674af11f2dba5378bcc9004
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..71e506bfa3eccda7bc6dd6c84591cd3e6258461c
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..291c982b59f8adbed7c72cbac57efc8d5d874d76
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc 'forge test -vvv && node --check scripts/receipt-costs.mjs && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 exited 1 in 2415ms:
Error: Read-only file system (os error 30)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3566c449f03c25f6f674af11f2dba5378bcc9004
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..71e506bfa3eccda7bc6dd6c84591cd3e6258461c
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..291c982b59f8adbed7c72cbac57efc8d5d874d76
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc 'mkdir -p /tmp/foundry-cache /tmp/foundry-home && XDG_CACHE_HOME=/tmp/foundry-cache FOUNDRY_HOME=/tmp/foundry-home forge test -vvv && node --check scripts/receipt-costs.mjs && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 exited 1 in 2013ms:
Error: Read-only file system (os error 30)

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3566c449f03c25f6f674af11f2dba5378bcc9004
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..71e506bfa3eccda7bc6dd6c84591cd3e6258461c
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..291c982b59f8adbed7c72cbac57efc8d5d874d76
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc 'XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home SVM_HOME=/home/damu/.svm forge test --offline -vvv' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 exited 1 in 29ms:
Error: can't install missing solc 0.8.30 in offline mode

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3566c449f03c25f6f674af11f2dba5378bcc9004
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..71e506bfa3eccda7bc6dd6c84591cd3e6258461c
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..291c982b59f8adbed7c72cbac57efc8d5d874d76
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "find /home/damu/.svm -maxdepth 3 -type f -name 'solc-*' -o -type f -name 'solc' 2>/dev/null | sed -n '1,60p'; find /home/damu/.foundry -maxdepth 3 -type f -name 'solc-*' 2>/dev/null | sed -n '1,60p'; node --check scripts/receipt-costs.mjs; git diff --check" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 62ms:
/home/damu/.svm/0.8.13/solc-0.8.13
/home/damu/.svm/0.8.19/solc-0.8.19
/home/damu/.svm/0.8.17/solc-0.8.17
/home/damu/.svm/0.8.24/solc-0.8.24
/home/damu/.svm/0.8.26/solc-0.8.26
/home/damu/.svm/0.8.28/solc-0.8.28
/home/damu/.svm/0.8.22/solc-0.8.22
/home/damu/.svm/0.8.33/solc-0.8.33
/home/damu/.svm/0.8.23/solc-0.8.23
/home/damu/.svm/0.8.20/solc-0.8.20

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..3566c449f03c25f6f674af11f2dba5378bcc9004
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,7 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.30"
+optimizer = true
+optimizer_runs = 200
+
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..71e506bfa3eccda7bc6dd6c84591cd3e6258461c
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..291c982b59f8adbed7c72cbac57efc8d5d874d76
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.30;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/foundry.toml
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/src/BatchDistributor.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/test/BatchDistributor.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a995ea68cb2d578d1c43899763105b814efff254
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a995ea68cb2d578d1c43899763105b814efff254
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc 'XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home SVM_HOME=/home/damu/.svm forge test --offline -vvv && node --check scripts/receipt-costs.mjs && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 exited 1 in 145ms:
Compiling 2 files with Solc 0.8.28
Solc 0.8.28 finished in 112.74ms
Compiler run successful!

Ran 1 test for test/BatchDistributor.t.sol:BatchDistributorTest
[FAIL: `testFail*` has been removed. Consider changing to test_Revert[If|When]_Condition and expecting a revert] testFailedTokenTransferRevertsTheBatch() (gas: 0)
Suite result: FAILED. 0 passed; 1 failed; 0 skipped; finished in 446.06µs (0.00ns CPU time)

Ran 1 test suite in 2.62ms (446.06µs CPU time): 0 tests passed, 1 failed, 0 skipped (1 total tests)

Failing tests:
Encountered 1 failing test in test/BatchDistributor.t.sol:BatchDistributorTest
[FAIL: `testFail*` has been removed. Consider changing to test_Revert[If|When]_Condition and expecting a revert] testFailedTokenTransferRevertsTheBatch() (gas: 0)

Encountered a total of 1 failing tests, 0 tests succeeded

Tip: Run `forge test --rerun` to retry only the 1 failed test

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a995ea68cb2d578d1c43899763105b814efff254
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function testFailedTokenTransferRevertsTheBatch() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/test/BatchDistributor.t.sol
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/PLAN.md
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

codex
I’ve added a deliberately conservative batch-distribution implementation: it does not pretend L1 data costs disappear, and the plan makes rollout conditional on a measured canary. I’m running the contract tests and syntax/checks now.
exec
/bin/bash -lc 'XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home SVM_HOME=/home/damu/.svm forge test --offline -vvv && node --check scripts/receipt-costs.mjs && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 192ms:
Compiling 1 files with Solc 0.8.28
Solc 0.8.28 finished in 105.63ms
Compiler run successful!

Ran 3 tests for test/BatchDistributor.t.sol:BatchDistributorTest
[PASS] testDistributesEveryPaymentAndEmitsNoPartialState() (gas: 72462)
[PASS] testRejectsMismatchedInput() (gas: 8997)
[PASS] test_RevertWhen_TokenTransferFails() (gas: 42713)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 821.45µs (574.65µs CPU time)

Ran 1 test suite in 2.56ms (821.45µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
?? PLAN.md
?? foundry.toml
?? scripts/
?? src/
?? test/

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "node scripts/receipt-costs.mjs <(printf '%s\\n' '0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0') https://mainnet.base.org 2511.505 && git diff --check" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 592ms:
{
  "transactions": 1,
  "gasUsed": "45047",
  "l2Eth": "0.000000270",
  "l1DataEth": "0.000000000",
  "totalEth": "0.000000271",
  "ethUsd": 2511.505,
  "totalUsd": 0.00068,
  "averageUsd": 0.00068004
}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "curl -sS https://mainnet.base.org -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_getTransactionReceipt\",\"params\":[\"0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0\"]}' | jq .; curl -sS https://mainnet.base.org -H 'content-type: application/json' --data '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"optimism_getTransactionReceipt\",\"params\":[\"0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0\"]}' | jq ." in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 869ms:
{
  "jsonrpc": "2.0",
  "result": {
    "blobGasUsed": "0x39d0",
    "blockHash": "0x9831c921c8c827d4aafa3c3815a3779458cb07368a02d3cc5d89295f1f23030e",
    "blockNumber": "0x303382a",
    "contractAddress": null,
    "cumulativeGasUsed": "0x1964a56",
    "daFootprintGasScalar": "0x94",
    "effectiveGasPrice": "0x5b8d80",
    "from": "0x1d7f97d26ae2c01f9b01fc252b73cf0db3397e95",
    "gasUsed": "0xaff7",
    "l1BaseFeeScalar": "0x8dd",
    "l1BlobBaseFee": "0x29c82c",
    "l1BlobBaseFeeScalar": "0x101c12",
    "l1Fee": "0x1d1bcc14",
    "l1GasPrice": "0x3458b55",
    "l1GasUsed": "0x640",
    "logs": [
      {
        "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        "blockHash": "0x9831c921c8c827d4aafa3c3815a3779458cb07368a02d3cc5d89295f1f23030e",
        "blockNumber": "0x303382a",
        "blockTimestamp": "0x6a90cd37",
        "data": "0x0000000000000000000000000000000000000000000000000000000000058200",
        "logIndex": "0x59c",
        "removed": false,
        "topics": [
          "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x0000000000000000000000001d7f97d26ae2c01f9b01fc252b73cf0db3397e95",
          "0x0000000000000000000000003cdce9661f6d8475dfdd8bc3470ae1434e6977af"
        ],
        "transactionHash": "0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0",
        "transactionIndex": "0x3d"
      }
    ],
    "logsBloom": "0x00000000000000000000080000000000000000000000000000000004000000000000000000000000000020000000100000000000000000000000000000002000000000000000000000000008000000000000000000080000000000000000000000800000008000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "status": "0x1",
    "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    "transactionHash": "0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0",
    "transactionIndex": "0x3d",
    "type": "0x2"
  },
  "id": 1
}
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "rpc method is unsupported"
  },
  "id": 2
}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "node -e 'fetch(\"https://mainnet.base.org\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({jsonrpc:\"2.0\",id:1,method:\"eth_getTransactionReceipt\",params:[\"0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0\"]})}).then(x=>x.json()).then(x=>console.log(x.result.l1Fee, BigInt(x.result.l1Fee)))'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 565ms:
0x1d1bcc14 488360980n

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "nl -ba scripts/receipt-costs.mjs | sed -n '1,140p'; node scripts/receipt-costs.mjs /dev/stdin https://mainnet.base.org 2511.505 <<'EOF'
0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0
EOF" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 640ms:
{
  "transactions": 1,
  "gasUsed": "45047",
  "l2Eth": "0.000000270",
  "l1DataEth": "0.000000000",
  "totalEth": "0.000000271",
  "ethUsd": 2511.505,
  "totalUsd": 0.00068,
  "averageUsd": 0.00068004
}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..7fc7eccc8b033cf700455b834e291125570302f4
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,49 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(9);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/scripts/receipt-costs.mjs
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "node scripts/receipt-costs.mjs /dev/stdin https://mainnet.base.org 2511.505 <<'EOF'
0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0
EOF
node - <<'EOF'
const p=2511.505, l2=270282000n,l1=488360980n; const dollar=x=>Number(x)/1e18*p; const t=dollar(l2+l1);console.log({l2:dollar(l2),l1:dollar(l1),total:t,daily:t*40000,annual:t*40000*365});
const b=dollar(25105n*6000000n+l1);console.log({batch:b,savings:t-b, annual:(t-b)*40000*365, pct:(t-b)/t});
EOF" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 681ms:
{
  "transactions": 1,
  "gasUsed": "45047",
  "l2Eth": "0.000000270282",
  "l1DataEth": "0.000000000488",
  "totalEth": "0.000000270770",
  "ethUsd": 2511.505,
  "totalUsd": 0.00068,
  "averageUsd": 0.00068004
}
{
  l2: 6.7881459441e-7,
  l1: 0.0000012265210430749,
  total: 0.0000019053356374849,
  daily: 0.076213425499396,
  annual: 27.81790030727954
}
{
  batch: 0.0003795345191930749,
  savings: -0.00037762918355559,
  annual: -5513.386079911614,
  pct: -198.19562292661033
}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..b500ce3bdc23b55f7fbf3b1b7af8cc154b486845
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 758,642,980 wei = $0.000001905 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$0.0762/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$27.82/year** | $0.0762 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. At this rate, the cost is already tiny; do not assume a mainnet or another L2 migration saves money. The L1 data component is 64% of this measured transfer, so execution-only optimizations have a hard ceiling.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$27.82/year (100%)**; at 80% eligibility, **$22.25/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4.4/year (16%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.000001604/payment vs $0.000001905 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | On Base the entire current annual bill is ~$28 and L1 data dominates. Engineering/review cost will exceed the likely gas reduction. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It is ranked above fee tuning only because it has a measurable, if modest, ongoing saving. It should not be adopted merely to save a few dollars if its custody and operational cost is larger.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/PLAN.md
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1412ad69e6bfb5b03d2ca43e0ffe57c839ff9d99
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 270,770,360,980 wei = $0.00068004 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$27.20/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$9,928.58/year** | $27.20 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. Do not assume a mainnet or another L2 migration saves money. The L1 data component is about 0.18% of this measured transfer, so batching can materially reduce the dominant per-transaction L2 intrinsic gas.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$9,928.58/year (100%)**; at 80% eligibility, **$7,942.86/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4,388/year (44%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.0003795/payment vs $0.0006800 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | A token-specific change can help, but needs a receipt-level benchmark; changing chains is not justified by this Base-only fee sample. Engineering/review cost may exceed the remaining savings. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It should be adopted only if the projected annual saving exceeds its custody and operational cost.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1412ad69e6bfb5b03d2ca43e0ffe57c839ff9d99
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 270,770,360,980 wei = $0.00068004 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$27.20/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$9,928.58/year** | $27.20 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. Do not assume a mainnet or another L2 migration saves money. The L1 data component is about 0.18% of this measured transfer, so batching can materially reduce the dominant per-transaction L2 intrinsic gas.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$9,928.58/year (100%)**; at 80% eligibility, **$7,942.86/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4,388/year (44%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.0003795/payment vs $0.0006800 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | A token-specific change can help, but needs a receipt-level benchmark; changing chains is not justified by this Base-only fee sample. Engineering/review cost may exceed the remaining savings. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It should be adopted only if the projected annual saving exceeds its custody and operational cost.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

exec
/bin/bash -lc "XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home SVM_HOME=/home/damu/.svm forge test --offline -vvv && node --check scripts/receipt-costs.mjs && node scripts/receipt-costs.mjs /dev/stdin https://mainnet.base.org 2511.505 <<'EOF'
0x2c2a53ce984c5d359e1c10cb5f09f33153460730dcbcb4c8cc18efe8d5a1d1f0
EOF
git diff --check && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002
 succeeded in 758ms:
No files changed, compilation skipped

Ran 3 tests for test/BatchDistributor.t.sol:BatchDistributorTest
[PASS] testDistributesEveryPaymentAndEmitsNoPartialState() (gas: 72462)
[PASS] testRejectsMismatchedInput() (gas: 8997)
[PASS] test_RevertWhen_TokenTransferFails() (gas: 42713)
Suite result: ok. 3 passed; 0 failed; 0 skipped; finished in 452.71µs (404.92µs CPU time)

Ran 1 test suite in 2.58ms (452.71µs CPU time): 3 tests passed, 0 failed, 0 skipped (3 total tests)
{
  "transactions": 1,
  "gasUsed": "45047",
  "l2Eth": "0.000000270282",
  "l1DataEth": "0.000000000488",
  "totalEth": "0.000000270770",
  "ethUsd": 2511.505,
  "totalUsd": 0.00068,
  "averageUsd": 0.00068004
}
?? PLAN.md
?? foundry.toml
?? scripts/
?? src/
?? test/

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1412ad69e6bfb5b03d2ca43e0ffe57c839ff9d99
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 270,770,360,980 wei = $0.00068004 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$27.20/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$9,928.58/year** | $27.20 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. Do not assume a mainnet or another L2 migration saves money. The L1 data component is about 0.18% of this measured transfer, so batching can materially reduce the dominant per-transaction L2 intrinsic gas.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$9,928.58/year (100%)**; at 80% eligibility, **$7,942.86/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4,388/year (44%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.0003795/payment vs $0.0006800 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | A token-specific change can help, but needs a receipt-level benchmark; changing chains is not justified by this Base-only fee sample. Engineering/review cost may exceed the remaining savings. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It should be adopted only if the projected annual saving exceeds its custody and operational cost.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

codex
Completed the cost plan and shippable batching implementation.

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/PLAN.md) ranks savings: internal netting (up to ~$9.9k/year) then 200-recipient batching (~$4.4k/year estimated), with live Base fee inputs and explicit assumptions.
- [BatchDistributor.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/src/BatchDistributor.sol) provides atomic, operator-only ERC-20 batch payouts.
- [receipt-costs.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/scripts/receipt-costs.mjs) calculates actual L2 and Base L1-data fees from your relayer’s transaction hashes.
- Added Foundry tests; all 3 pass.

The plan flags that the reported baseline is a live comparable USDC transfer because no relayer address/receipts were supplied. Run the included script on seven days of relayer hashes before approving rollout.
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..1412ad69e6bfb5b03d2ca43e0ffe57c839ff9d99
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,52 @@
+# Base relayer gas plan
+
+## Measured baseline (27 August 2026)
+
+The workspace did not include the relayer address or its receipts, so the baseline uses a live, successful Base USDC `transfer` as the closest public equivalent. It is a planning estimate, not an invoice. Run `node scripts/receipt-costs.mjs tx-hashes.txt` over the relayer's completed hashes to replace it with the actual spend; it includes Base's L1 data fee, which is easy to miss.
+
+| Input | Live value | Evidence |
+| --- | ---: | --- |
+| ERC-20 transfer L2 gas used | 45,047 | Base receipt `0x2c2a…a1d1f0` |
+| Effective L2 price | 0.006 gwei | same receipt / live `eth_gasPrice` |
+| Base L1 data fee | 488,360,980 wei | same receipt `l1Fee` |
+| L2 execution fee | 270,282,000,000 wei | `45,047 × 6,000,000` |
+| Total per transfer | 270,770,360,980 wei = $0.00068004 | includes L1 fee, ETH = $2,511.505 live Coinbase spot |
+| 40,000 transfers/day | **$27.20/day** | 40,000 × per-transfer cost |
+| 365-day run rate | **$9,928.58/year** | $27.20 × 365 |
+
+The live Base base fee was 0.005 gwei and the network quote was 0.006 gwei. Do not assume a mainnet or another L2 migration saves money. The L1 data component is about 0.18% of this measured transfer, so batching can materially reduce the dominant per-transaction L2 intrinsic gas.
+
+Formula: `total USD = (gasUsed × effectiveGasPrice + l1Fee) / 1e18 × ETH/USD`.
+
+## Ranked actions
+
+| Rank | Change | Estimated saving | Why / gate |
+| ---: | --- | ---: | --- |
+| 1 | Net eligible payments internally and settle each recipient's net balance on-chain | Up to **$9,928.58/year (100%)**; at 80% eligibility, **$7,942.86/year** | This is the only option that removes both the ERC-20 execution and Base L1-data fee. Only use it where product, custody, accounting, and user-finality requirements permit delayed/net settlement. |
+| 2 | Batch same-token payouts from a prefunded distributor (ship below) | **about $4,388/year (44%)** at 200 payouts/call, conservatively | A direct transfer's 45,047 L2 gas includes its 21,000-gas transaction intrinsic cost. A 200-recipient loop is estimated at ~25,105 L2 gas/recipient (intrinsic gas amortized); holding the measured $0.000001227 L1 fee/payment unchanged gives $0.0003795/payment vs $0.0006800 today. This needs a Base canary receipt before rollout: calldata compression and the token's implementation can move the result. It also changes token custody to the distributor. |
+| 3 | Submit EIP-1559 fees from a fresh Base quote, with a bounded replacement policy | **$0 today, prevention only** | The observed network quote is already 0.006 gwei. There is no justified saving to claim without the relayer's fee fields. Do not hardcode a mainnet tip; log `effectiveGasPrice` and alert when it exceeds a defined multiplier of `eth_gasPrice`. |
+| 4 | Micro-optimize ERC-20 calls or move chains | **not recommended** | A token-specific change can help, but needs a receipt-level benchmark; changing chains is not justified by this Base-only fee sample. Engineering/review cost may exceed the remaining savings. |
+
+The batch estimate excludes one-time deployment and periodic funding transfers; those make the initial period slightly worse. It should be adopted only if the projected annual saving exceeds its custody and operational cost.
+
+## Implementation and rollout
+
+1. **Measure the actual account for seven days.** Export successful Base transaction hashes (one per line), run `node scripts/receipt-costs.mjs tx-hashes.txt`, and divide its result by the number of successful ERC-20 transfers. Keep L2 and `l1Fee` as separate finance fields.
+2. **Canary the distributor.** Deploy `src/BatchDistributor.sol` with the relayer multisig as `operator`, fund it with one supported token, and send 10 then 50 payments. Compare their receipts with the baseline using the supplied script. Start at 50; increase only after checking gas and operational recovery procedures, up to the built-in 200 maximum.
+3. **Operational controls.** Use a hardware-backed multisig operator, reconcile the contract balance against the payment queue before every batch, and treat a reverted batch as an all-or-nothing retry. The contract deliberately has no generic withdrawal function: deploy a new reviewed version if recovery policy is needed rather than silently widening the attack surface.
+4. **Ship only on a positive measured result.** Require at least a 10% total-fee reduction after funding/deployment amortization and an approved custody/accounting review. If it fails, retain direct transfers and the receipt-cost dashboard.
+
+## Shipped artifacts
+
+- `src/BatchDistributor.sol`: atomic, operator-only, same-token batched ERC-20 distribution; validates all inputs and caps calls at 200 recipients.
+- `test/BatchDistributor.t.sol`: tests successful delivery, malformed input, and all-or-nothing failure.
+- `scripts/receipt-costs.mjs`: sums L2 execution and Base L1 data fees from actual transaction receipts; fetches ETH/USD live unless supplied as an argument for reproducible reporting.
+
+Validate locally with:
+
+```bash
+XDG_CACHE_HOME=/tmp/foundry-cache XDG_CONFIG_HOME=/tmp/foundry-config \
+  XDG_DATA_HOME=/tmp/foundry-data FOUNDRY_HOME=/tmp/foundry-home \
+  SVM_HOME=/home/damu/.svm forge test --offline
+node scripts/receipt-costs.mjs tx-hashes.txt
+```
diff --git a/foundry.toml b/foundry.toml
new file mode 100644
index 0000000000000000000000000000000000000000..a7ee4fd5a6578b90facce16acf4d68eaa1529fb2
--- /dev/null
+++ b/foundry.toml
@@ -0,0 +1,6 @@
+[profile.default]
+src = "src"
+test = "test"
+solc_version = "0.8.28"
+optimizer = true
+optimizer_runs = 200
diff --git a/scripts/receipt-costs.mjs b/scripts/receipt-costs.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..63c2076b267adfd0231e4e97cf7e18911e051828
--- /dev/null
+++ b/scripts/receipt-costs.mjs
@@ -0,0 +1,50 @@
+#!/usr/bin/env node
+/**
+ * Sum actual Base fees for transaction hashes, including the OP Stack L1 data fee.
+ * Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]
+ */
+import { readFile } from "node:fs/promises";
+
+const [file, rpcUrl = "https://mainnet.base.org", ethUsdArg] = process.argv.slice(2);
+if (!file) throw new Error("Usage: node scripts/receipt-costs.mjs tx-hashes.txt [rpc-url] [eth-usd]");
+
+const hashes = (await readFile(file, "utf8"))
+  .split(/\s+/).filter(Boolean).filter((hash) => /^0x[0-9a-fA-F]{64}$/.test(hash));
+if (!hashes.length) throw new Error("No valid transaction hashes found");
+
+let nextId = 1;
+async function rpc(method, params) {
+  const response = await fetch(rpcUrl, {
+    method: "POST", headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
+  });
+  const body = await response.json();
+  if (!response.ok || body.error) throw new Error(body.error?.message ?? `HTTP ${response.status}`);
+  return body.result;
+}
+
+const ethUsd = ethUsdArg ? Number(ethUsdArg) : Number((await (await fetch(
+  "https://api.coinbase.com/v2/prices/ETH-USD/spot"
+)).json()).data.amount);
+if (!Number.isFinite(ethUsd)) throw new Error("ETH/USD quote is invalid");
+
+const receipts = await Promise.all(hashes.map((hash) => rpc("eth_getTransactionReceipt", [hash])));
+if (receipts.some((receipt) => !receipt)) throw new Error("At least one transaction hash was not found");
+
+let l2Wei = 0n, l1Wei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const used = BigInt(receipt.gasUsed);
+  gasUsed += used;
+  l2Wei += used * BigInt(receipt.effectiveGasPrice);
+  // Base adds this field. Old/non-Base receipts safely report zero, never a guessed fee.
+  l1Wei += BigInt(receipt.l1Fee ?? "0x0");
+}
+const totalWei = l2Wei + l1Wei;
+const usd = Number(totalWei) / 1e18 * ethUsd;
+// Base fees are commonly below 1 gwei; nine decimals would hide the L1 component.
+const fmtEth = (wei) => (Number(wei) / 1e18).toFixed(12);
+console.log(JSON.stringify({
+  transactions: hashes.length, gasUsed: gasUsed.toString(),
+  l2Eth: fmtEth(l2Wei), l1DataEth: fmtEth(l1Wei), totalEth: fmtEth(totalWei),
+  ethUsd, totalUsd: Number(usd.toFixed(6)), averageUsd: Number((usd / hashes.length).toFixed(8)),
+}, null, 2));
diff --git a/src/BatchDistributor.sol b/src/BatchDistributor.sol
new file mode 100644
index 0000000000000000000000000000000000000000..e92a87550990fef2f1eed3803560696532a49807
--- /dev/null
+++ b/src/BatchDistributor.sol
@@ -0,0 +1,55 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+/// @notice Minimal ERC-20 interface used by BatchDistributor.
+interface IERC20 {
+    function transfer(address to, uint256 amount) external returns (bool);
+}
+
+/// @notice Sends an ERC-20 balance held by this contract to many recipients in one transaction.
+/// @dev The operator controls distributions; keep the operator in a hardware-backed multisig.
+contract BatchDistributor {
+    error NotOperator();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ZeroRecipient(uint256 index);
+    error TransferFailed(address token, address recipient, uint256 amount);
+
+    /// @dev Caps a call so a bad input cannot make the transaction exceed the block gas limit.
+    uint256 public constant MAX_BATCH_SIZE = 200;
+
+    address public immutable operator;
+
+    event Distributed(address indexed token, uint256 indexed count, uint256 totalAmount);
+
+    constructor(address operator_) {
+        if (operator_ == address(0)) revert ZeroRecipient(0);
+        operator = operator_;
+    }
+
+    /// @notice Distribute `token` already held by this contract.
+    /// @dev Reverts atomically if any token transfer fails; callers can safely retry the whole batch.
+    function distribute(IERC20 token, address[] calldata recipients, uint256[] calldata amounts) external {
+        if (msg.sender != operator) revert NotOperator();
+
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+
+        uint256 totalAmount;
+        for (uint256 i; i < length; ++i) {
+            address recipient = recipients[i];
+            if (recipient == address(0)) revert ZeroRecipient(i);
+
+            uint256 amount = amounts[i];
+            totalAmount += amount;
+            if (!token.transfer(recipient, amount)) {
+                revert TransferFailed(address(token), recipient, amount);
+            }
+        }
+
+        emit Distributed(address(token), length, totalAmount);
+    }
+}
diff --git a/test/BatchDistributor.t.sol b/test/BatchDistributor.t.sol
new file mode 100644
index 0000000000000000000000000000000000000000..1b5ca6b19ad557c7d73404e1270e477751122e1d
--- /dev/null
+++ b/test/BatchDistributor.t.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.28;
+
+import {BatchDistributor, IERC20} from "../src/BatchDistributor.sol";
+
+contract MockToken is IERC20 {
+    mapping(address => uint256) public balanceOf;
+    bool public fail;
+
+    function mint(address account, uint256 amount) external { balanceOf[account] += amount; }
+    function setFail(bool value) external { fail = value; }
+    function transfer(address to, uint256 amount) external returns (bool) {
+        if (fail || balanceOf[msg.sender] < amount) return false;
+        balanceOf[msg.sender] -= amount;
+        balanceOf[to] += amount;
+        return true;
+    }
+}
+
+contract BatchDistributorTest {
+    BatchDistributor private distributor;
+    MockToken private token;
+
+    function setUp() public {
+        distributor = new BatchDistributor(address(this));
+        token = new MockToken();
+        token.mint(address(distributor), 1000);
+    }
+
+    function testDistributesEveryPaymentAndEmitsNoPartialState() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+
+        distributor.distribute(token, recipients, amounts);
+
+        require(token.balanceOf(recipients[0]) == 10, "first payment missing");
+        require(token.balanceOf(recipients[1]) == 20, "second payment missing");
+        require(token.balanceOf(address(distributor)) == 970, "incorrect remaining balance");
+    }
+
+    function testRejectsMismatchedInput() public {
+        address[] memory recipients = new address[](1);
+        recipients[0] = address(0xA11CE);
+        uint256[] memory amounts = new uint256[](0);
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "mismatched input accepted");
+    }
+
+    function test_RevertWhen_TokenTransferFails() public {
+        address[] memory recipients = new address[](2);
+        recipients[0] = address(0xA11CE);
+        recipients[1] = address(0xB0B);
+        uint256[] memory amounts = new uint256[](2);
+        amounts[0] = 10;
+        amounts[1] = 20;
+        token.setFail(true);
+
+        (bool ok,) = address(distributor).call(
+            abi.encodeCall(distributor.distribute, (token, recipients, amounts))
+        );
+        require(!ok, "failed transfer accepted");
+        require(token.balanceOf(recipients[0]) == 0, "partial payment escaped");
+        require(token.balanceOf(address(distributor)) == 1000, "batch did not revert");
+    }
+}

tokens used
85,574
````

## final message

Completed the cost plan and shippable batching implementation.

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/PLAN.md) ranks savings: internal netting (up to ~$9.9k/year) then 200-recipient batching (~$4.4k/year estimated), with live Base fee inputs and explicit assumptions.
- [BatchDistributor.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/src/BatchDistributor.sol) provides atomic, operator-only ERC-20 batch payouts.
- [receipt-costs.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-27T234937Z-codex-with-skill-1/gas-goal-002/scripts/receipt-costs.mjs) calculates actual L2 and Base L1-data fees from your relayer’s transaction hashes.
- Added Foundry tests; all 3 pass.

The plan flags that the reported baseline is a live comparable USDC transfer because no relayer address/receipts were supplied. Run the included script on seven days of relayer hashes before approving rollout.
