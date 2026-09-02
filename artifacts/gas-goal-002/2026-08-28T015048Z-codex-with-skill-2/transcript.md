# Executor transcript — 2026-08-28T015048Z-codex-with-skill-2

**executor**: codex  |  **model**: gpt-5.6-terra  |  **exit**: 0
**workspace**: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002

## session

```text
OpenAI Codex v0.150.1
--------
workdir: /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
model: gpt-5.6-terra
provider: openai
approval: never
sandbox: workspace-write [workdir, /tmp, $TMPDIR] (network access enabled)
reasoning effort: none
reasoning summaries: none
session id: 01a04610-047d-7412-a626-3f3b9758177e
--------
user
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.

2026-08-28T01:50:50.191730Z ERROR codex_core::shell_snapshot: Shell snapshot validation failed: Snapshot command exited with status exit status: 2: /home/damu/.codex/shell_snapshots/01a04610-047d-7412-a626-3f3b9758177e.tmp-1787881849990148020: line 2547: syntax error near unexpected token `('

codex
I’ll quantify the current spend and rank practical reductions by savings, then implement the code-side improvements with tests or verification where the repo supports them. I’m using the gas-cost guidance because this is specifically a fee-analysis and EIP-1559 optimization task.
exec
/bin/bash -lc "sed -n '1,240p' /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/.agents/skills/gas/SKILL.md && pwd && rg --files -g '"'!*node_modules*'"' -g '"'!*.lock'"' | sed -n '1,240p'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 0ms:
exec
/bin/bash -lc "sed -n '1,260p' TASK.md && sed -n '1,260p' package.json && find . -maxdepth 3 -type f -not -path './.git/*' -print | sort" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 0ms:
stty: 'standard input': Inappropriate ioctl for device
We run a payments app on Base — about 40,000 ERC-20 transfers a day, all sent
from our own relayer wallet. Finance is asking what we actually spend on gas
and what we can do about it.

Work in this directory. Write me a plan in PLAN.md, ranked by what each change
actually saves, with the numbers behind it. Implement the parts that are code
so we can ship them.
{
  "name": "eval-workspace",
  "private": true
}
./TASK.md
./package.json

codex
The repository is intentionally bare, so I’m adding a small dependency-free Node implementation rather than modifying an existing relayer. I’ll base the finance figures on live Base fee data and clearly separate measured transaction costs from savings that require a batching contract.
exec
/bin/bash -lc "set -euo pipefail
rpc='https://mainnet.base.org'
rpc_call() { curl -sS --max-time 20 -H 'content-type: application/json' --data \""'$1" "$rpc"; }
rpc_call '"'{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_gasPrice\",\"params\":[]}'
rpc_call '{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"eth_maxPriorityFeePerGas\",\"params\":[]}'
rpc_call '{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"eth_getBlockByNumber\",\"params\":[\"latest\",false]}'
printf '\\nETH_USD='; curl -sS --max-time 20 'https://api.coinbase.com/v2/prices/ETH-USD/spot'" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 1261ms:
{"jsonrpc":"2.0","result":"0x5b8d80","id":1}
{"jsonrpc":"2.0","result":"0xf4240","id":2}
{"jsonrpc":"2.0","result":{"baseFeePerGas":"0x4c4b40","blobGasUsed":"0x7b8114","difficulty":"0x0","excessBlobGas":"0x0","extraData":"0x01000000640000000500000000004c4b40","gasLimit":"0x17d78400","gasUsed":"0x2eec21a","hash":"0xc31aee10f547ad38a8ae691438ad888d162b78d9bfe75bb931e5bb993040b644","logsBloom":"0xdef7e51a5311f4d0c4a3de8fba1fd9ecb13bee64fece3fb43e9c7ebf245a264b256eb32a780e341de52febdbe222f6556e3fa8b24ee7fb40febe2f90d17ff37e3677a5b6ec52a7ee3a7c586e430037e4daec3d67de6ddbb252b39f80f2efba5d3dd8f2f7becf0a657f648ff2be87b8b8fde95972e80db635babfde5a339baf11dbbf727a7f2a59e953ef8e36f41de9e15366b2770aa7d2edb2a2ee4e318cfb5cf2d477c3e780be641ce0e3851ce3f5b3b757f37bbc52475e29f3b7ad5fa05b95eb0c56ebe4e2f6c73cd3f9f5c7a494c5677c85df867eee5ae55571cf481bff4f993f7a49a5879262fe5c8e431773efefadb6f4e6fb977cece2b4b68d3ed7cfdc","miner":"0x4200000000000000000000000000000000000011","mixHash":"0xb1811050a59565374190df7239d65824672c7f01e73327c6ea2e49ba749b1101","nonce":"0x0000000000000000","number":"0x303465f","parentBeaconBlockRoot":"0x8d13cab28deef27d5824effc5f3f646806d72f9263c96d21cba3eb55022a9eed","parentHash":"0xeac0ee3f43df846823fd3f658fa65d4617cd12867c9f0d36b66f7189f9001ec7","receiptsRoot":"0x858dde48b8a5503dd380c4c0e9830c56ba8bd47220bf4ad80a2f0de41e050b93","requestsHash":"0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855","sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347","size":"0x22a61","stateRoot":"0x2e63f7fc582dd7e32f198a66368d91b4c8bbbb3f76c31bf30fe254c1be138855","timestamp":"0x6a90e9a1","transactions":["0x732971a6ba353d13eb691ecab005f757662c8f5dec980920b321654d3199ff85","0x0327c602d94e1f129d24c65b46403bcc5abd4689943d5682315d2bfb10e243d8","0x73853eadd16b95c983b960ceff57d374a2e8509250f5a2b6941d305ad62dd49d","0x6f11952da107ac5318f257f9de611e38de0d111be10cfdaa0aad5653213691d1","0x7d5e9ffae816300c5f3a92146f7fde7ac572c50a8629d98e581cc92d74f7854c","0x0ab00dea50ee8ada18a97ccaad72137152c93273b4230220733750ef010c5945","0x75d01fd4c30ef9ee7077fe2b07aaba43d6e364956c561c19bb6763dd55992e7f","0x458b7f7ff3745c96f0f693eaab2dd982cd93cb9155fc488e9ede39cc8ec721d2","0x5751db005c63846c0fd76a844fad7c8c8bf6ed66d55d5f411ad0decf9555b47d","0x69d1a69f5c850bc072e28f78b2ca1b07ad9da7ac96c72e7c1f22e14bd8ca3ef5","0x2013197b04a62bfb86f6caae257ee9bfe05f081ed187fa92a8122f5bd7198a90","0xc511ddf191496378cfbebc4e6a33e1fa48286d4ed62e14d6a6ae922bb24754dd","0xa007a0f0d03353ba24c0ea094e90f9813424cb49620cf6d01e5b8dff4596b705","0xaf2997e96d00697d6d93d7beea8cdaece86be014ad336b03d65618f97ecc3c73","0xaabd4923eb8e08a33add92922553e7a98cf75e64de521b053596ec599461f8b5","0xa1c77054e136bad7da14e0a914d40f0969cf69accb59bd0a4ae01c1e0449b7aa","0x1a1ba2689d98c73b314f55c06d38725796bb955bd8b130a7b605eb5eae71d008","0x705b5cd13a2644bf82d582dc076624f9b197d9a80305a38b44db9f98996d020a","0x7794ac95bc141c70ee60f672353d2d263c3ff321adf72051bfb82199046478d8","0xf52b32410bd60a032a4768bf547393146c8aeeb41da7e329ff0a1b51045b4059","0xd8fbd743c53cd5e75275549d5fc3663a2a8058514969dff9695be7aa69619bfc","0x6862ac88f961d5485eabf55deb9955ff53a8a479c2aab23344f1e0d482d6874b","0x0b7c9672b96092faab97b9681d36c4dd71803b71346b9708b0ab39ca09721f18","0xb156a3a6dcd8ee7af20abf4adefed34a026e1d3df673a75af8477fe8f9dcb1a2","0x7ce64a492a17890e6f5129dd3e028a37169c9f4547f88872a5bc32ac508556f2","0x6a64ca45fd219a657c4b244908dd84f0453d83068e6174955c5da958b3418ad6","0x14d3cfb91fac1ef4d6bd437b7d5b33a30c9c02f448ced33dede5bffcbf842b10","0xbfc959d1df4f3af8737e501fcedbbe54ebe8f89fc07d9c33afd9c9be85977c80","0x43d5c85ea79d28bb2e7ccc12d955702da6463527c1ae8737c3299cb0da50279b","0x36462035b4019b5e292ffd7ceba6b38f5f591da8549311b3e749f00f22a05b11","0x6e460b8ba6ee1442287d8f6d73e66b0927a470f0559b7fcfba4800218fa3886f","0x9fe381075d5bdceddef07479ae30718b740de757163aa248744d856711896bb3","0x7eca6e869357faf8ddefb870fd3fd03b1f97110f9d136a3f40346f7eb27ab78e","0x81baab56b5286dc40a3562e570c51692c861bfd7d4c374aeb782590f629f6263","0xf0d8986d4c7b60c7e3d423e83b0fa04c64a97a7001c72ac8c46e9a16c5440f29","0x5496217ddd0ce69b216c7729f929a1115da64922439bc1ed75e15d3e6c42e250","0xe72e5ebd7b76291eb2fab242153906adf4ca0ced7f0a3ef9cfc0a673935a1c52","0xd396f2fd49f86a94821f62b5b5a8e01681fd06e26edbeddb17091a6cc381cb9b","0xa3dfa33ae47d2fe4ae965e55a1036f44c890a554a6d76ee50f4867f7d7813a60","0xe8f7c44b07c41e32944f742effc50e3215964e537acb88bac6d94fc1e7792787","0x23da645d2899364329dc93e616bc1dc6f848b5e8ebd5915e9fe15b8953d7040b","0x5da8704bfbb60505c56076268934eeed282f0ce646a0de42f39926ecc20fd743","0x626ab666f53bbc3f56e954c6977acbd213829b9ab9fdfd1ad29c6c9131202311","0xc331a0e11a68964466f4eccbe45fd2962167947fc7cc15f23dc5324c69d06dba","0xdb3d3a367bc5ad248aa300036c5075195fce8278ee5771312cdce7e933b6f78c","0xe258ed7f3b3609fc6ace182d7a150fe6705b714b85b1f347b8971616a6759d00","0xadacfae7ec241d463432770285aa549b2d39c471cc46f50379f2ef1706a8719d","0xbc417de755ef9dc5c150ab48412230b5e84ed1d1492e411cfad2cd2c5e8ea4f9","0x25836c4c65cd3e202ab4aba288dd6ee2e8655a78d86b6e93842994988a2b9511","0xbb44844fdb3bdf84ed9ef4fc9b3427d3603d1d6700abbdd500328a74fa24d61c","0x7dc1e31111b5b40e5da4d35ba62ae995e816f073baf67a48f9e1646e8fbb2640","0xa9ba7a8e013ca2acb440aeda4d61259e51e1251c84b2495cb5fc4e8dc52475be","0x8ad7186c2c53162b39c7ebb6722f622d5d8d5d7686df27198e7e6e41a466006d","0xfabc9019a0c1488170c9df5d3443b6bfbe43356481d7884f0babfbb05117eaf6","0x2a38eecec6ab46068383d521e31078dc8b16505e3c08c40757d88a13d0f19c4a","0xcf748e42a90425bbdf06d43d3844a0c6d090e7cb512117ca73563cfccef402f3","0xfbf42f7622be0688a206b661522bff28b30257d80ad3dce2602ccb22e013410d","0x850244625a0d13f947a805a1e0fa0a6e686ca2a41f9a50ab0b1203baef92af7d","0x260ab98f263badc0f34c944ab8ee86ceb30f79335a9028ba9944c7ad6531cc6f","0xc890837ca73c5dead0803ea11d941fcd8c9b193eb977db9dd9b596eee51de8c6","0x9e225820f1a869c125911806a30baab8c7a0450c676a0e38d3271a632534f0ac","0xc53735c5ff462eb323ce502eabbf5089eaff92f0671cdc46c4275099218322ba","0xee0575e7452cacdf72891396e4be7dfa608354d3900cdc07c3c30dd1991aa99c","0xf89932d0f5d9ca97b3c16b5112a45d1639405b1b3d9b03ed6af3e7d5e7793a6d","0x6e57b03f4183a421e31c3a111238b69900c45707ac7f3e7dd543625ded1aee72","0x6a5562020e70fefc379df0c497460ffdfe3df81d559b2e72c761a2dff2a298f0","0xb5371da36e2371b9ce9615021288838d2da4f9e8bc9907ed81c7a08a905b2779","0x250cebb72640c84a8720dbae71092d60452c0e5515ea8beb5708f32fff9b63f3","0x27e11542ed152c0f121000a6a218302fbc876c08399ec7c2fbbf54c20fb4aaa9","0x267296b67b2e87bed8899be1e83c1737dab09fe477987c07340041b18570a8e1","0xc17da6a1621a140a32b260a3b3bbbe47deab69ec19870d2919ec998baa5b6773","0x3a73804bd4bc829ff4d6e9dec174acae372c36516085a869d754f445d2995fdb","0x2b96c7331dff11437a93d9d745aebf08a5a0a1baf9dd745420a71133d080f743","0x59e517f1d766da68fb53f4c44daeca2b0a3299539d3fe59b8d534a3dc35d02d6","0x1f59c65b32afdd26a906814d57cc74a3369502cefb4fcdb6d11fa68626d81d47","0x36eb2e8c415272d62affd42a5e3b33dc10fd9f61f586f1f272ec912448dd2afe","0x4d56025b63f9c00726592b47f6175940711ff1a0b1fcb765c597145570e8d13b","0xc55168d39133fadbafbaa760d9aa2eb2f2e44e3e56b4cde1a42d50bead3d1e2c","0xba12b5a887fe9864b4a2c55bce98d9c186c5b511aa86b8200b32d5a94543d837","0x429df7ded1ed3a20bcec9c2763478d91e904940ee6649fe2db7ecf82ae4af21a","0x4fe48c881add2d96ae90d40711fcd3767fff632cd98388d18239823001d43d59","0x7793f96d2239250016e04fb2ab583e192a9992bab779a685f0be409c9b6dcb66","0x72f90ff0cd155cbfe6bf874b3bff5796ee2c5d9836313a9db7918f2eeda6d41a","0x8097964a3c0ffa12595fee1b89d609ebfaf54999d638128f59a3495a25e8f1d9","0x345d2767f79df0720ae8a54394c846ea0e10d5e6de70157416b46050c7cecabe","0xa3a74cc43b50084bdd49280aaf508331fe4c97ca8bbfbbde04c8d500ce45c0e8","0x31b2147053ab774c2ab885376034d3971c617ccc3bf0c9d8cdea5014bb924c98","0x3fadc4811be04c71ed361b1ec0c20d9ec9332d98d4817abeaab8feaa5660e39d","0x8e1909568de57e260055544e97a4e436d3c002f83278bd24fc6958143108dd94","0x41a09abf2f4ac7a7919f7a9590c9edabe5d0209adc69fbf02df82b445446b9ed","0xf7b4f616c1bca5f7f5d0220e063a408c5481fee5f3c1db5dced148b092df0432","0x1ab083c3b304b24132116ab6520431fbc0303d3d4ae0ada1d9912b6852ef5bf4","0x10696adb75f613d56b3c970c7f8ed3e5988c9fe8efe6164528a60c8ebd45ba48","0xd59407be0c58cf66f18fa2c2bfe490ed0359f291037e4931f1d29cb09f0072b2","0xe1812df2d6c24f742e7f53aa4c30a8ceeb3c9abaf65f2799e8b50e54b2ae572f","0x4e7a3d68f6dfd3573b676379a3058fb58c981845082129de2286ff1dae6e3750","0xd3197a99c9412cb1df6a26529651048121c3fa361cd368ae10fcfe795faa96bd","0xe1ef1a1c33d14d186b72550a8ed9469429ea057db3b905daee48d1ae2d5e1e39","0x2e1beab786a2a080546daa252fddd6919d3b9810900819742b9bf40ae368272f","0x82dd99e9d1213fe33a44559d74a43bbc79be3addf97255880ec00312cfa27f73","0xa360022091dd5a4491d879f1119f94aa00e8414f5cd401aad90eb92b24aca179","0xeeb27196ec1cfe7a5cba6e7ffbaece0e20d53f0cf6aeaecc5beaa33e5f04e132","0x6617649505e29b3f52266b01903bfbdbc0b20261f84f921937d61e7dd21ea971","0x5a64bb83542f430f6b52c3260bfb34821464b34a75d80b4498ed737f3bacf370","0x9903de58e20864962a81950df12cdb4d44625ceef066fe5328d466068a06e47d","0xa74db8797e23463df33f909aec6ffc445fe97fade06fd8ffbeb2bed085911f3d","0xa90c7580f1762e2db7d8e1996738ab5b5c4ab7094de1f678e165d11dbce8bdbd","0xb90c671752b62e7ec7e2a7365537c7c747d1ef1865cb6f5613d961f38a4b1ee4","0x6f0e6a283eb11742d6e3177590bfb2a757a5b461f5495fa20dbc64454f80cd0f","0xa480e10f356729f41715f6a7363ce9a2ef21d969eeb32790a9f068430b149e0c","0xb10e4174fd481dfa862a8c8bdca98233ca56bd8cd7858ffba3743c4dbaf3a1da","0x44af5162ab660f94848798755c4f5e8c815f1318b960d7459159cbf5e134ef3b","0x846839e14a0b4c9f54fe899001a77ca7c8c4f221ed5391496b6fc728af2946df","0x63d6a4f3b6f824e2601c31a037c87fd3cf212a991343bfddd2338a9ba52c8c2d","0xe5b97f059ab5a926fb2fe3ff01920a83f3a6b948e8b9dbb2e57de186d599a4c6","0xa03748af6b9b3f680794d235bb79e3a1488ed7400e6f7020d5755bda13e99de5","0x7971186e7b3ef171db7ddcc7a218c6adffbeb1ce07bb1fbcc8761165e17d6c38","0xf0c200241e7eee515a39c234bbae4c6af21b4a938639ff449d18f7f310db6474","0xbc98fe3d0041c3c00f952d08d4675d84a74cc432f3682d08a489784150c12446","0x5b2c7a16bce89e6a4eb33266c1adbacbeb9abade57dfe9d3e68cad8ad8ceec2b","0x62f68bb275a97a801fee867de11a556df0c2ae89b0da5532ad31807ef7646b2b","0x12a99ef1c9e254d5bc419c04afd1470ba1cc653de579113a3f5edf47849f8d9c","0x63cd3a58f8ab62dc2d9e339c62d7dd613b3b07568bf28b41ca9afe887f36078f","0xcbb9db4c0eeb46b929a6c9a07c36091ad4303c298b82b44eca77c71d1b23811c","0x226be8ea1f54479b0e57938a2469b8d93d82255a7a5d864bfa47c04cd2746dae","0x2c50b381b5d8d57556177335217bbc440437d6a99459ddff0dc0ae56448db794","0x42ee5a50415d3f56dcea916e28d24d8eb7c5104a39adb6ee23308568a1f42e5b","0x1459f217ee4ebf91e5d568a2ac281b5435c0fa15c38ad135a330da07ef30d2d6","0x4948d03006aace46bfed4e23d44cf794cee68d17e17d5235ee4cb0e47ab8db93","0x1d6ad59a648e56cea302a1579b973a9bd8d44a488cbbc886aef0b7b7131e1814","0xed027d83f40f4b5abe949a4316c2863c1d1d164bda51745ab16d468a28ea4ff0","0x78d5b2f6c8ab5b692cf2f5c843655d3e3457f729c035607a20386deb4c23e207","0x651706b258dc6f17e9ef27e9d325c18693d01ad21d739122c11cd320cf003d06","0xf5ee88b430d8e15eda28d674869c181f757059a4cd822b930132c4c192b9a8a9","0x6825b149e12439b4e2a412e2074125853c7b464f9fa05e3915d9a6882d9be12f","0xb0032ac9ed475a80a87a9753d9b1d4d5838ec93ba6bb96e746b4b8f4b8ba93b2","0x0e24cdf776e5ad3aa83d85a565f0dae81226378c5e1ffa83fe1489ef5a43ced6","0x743dde2adad7ef745b9920df32c44c93927994f263fa70a9e94c34a7ba3347ea","0xd8d40ab40b1615b9abbee9b8b5f2307ac79039244ea378dc1f20273ea54b2126","0x878fa05c98564e3e5861adb462f77b8233e425f2544509079d5a2831c21f6eb7","0x0067149790c3e6cf7d47a3efc1967a916f1d1e57710bdb9c19a837727c290a80","0x5b5c0c95a416e96d9802dce997bf1ace933d1078e5c07b80f1887f3ce99133ca","0x2af99af265921262f09cab58d7cc2021efad8536e4f6ecf2ef245230b472fad5","0xf2186f1b0b6937d65f5b7ceb3f925892d1c6d7ed19b7c2afaeeb84bb32646f13","0x351c310a66f0f0d0c13ed4dfc46924ac1243ace80dbbd17264244bde3a9c6ce1","0x4d34e461b282221ae4441a3c62028e502756a680d45e053697eeb0825c95ee83","0x43bc83861b0651a8aad580c37d16a4f084da85fd0bda35f34fdcfc14617984f6","0xd4c8b15ee42e9d810004568f7b2f06cf91fd70e9fa425e0e5ebf8cced191bff2","0xd730756207adfcde1f799ca5b9ef14283490c4c94f58cf48f96071371f70f304","0xeeaa3d0d74988c625a0e9fe1721c7a5aff29aa3d4965d3db7b29064e37c3b389","0x0dbf3d63ee4b46fce073f6ac73f05940a264b34726327216f7f2272a7d0c35e6","0x0e97eb4b81c00d70afc4ab3389d9f4a8c84e7b110328d272eb435b32631d7099","0xd2bb4c13ea0a6c425b3ec2dda097a827578248f0302da7b69db0a026345ae6d7","0xd6b77fc95e0a4976a3938491d41c48cb50f90e9308595a34d7b6e4ad31b8f00a","0xb65b825f1b6fef21ca1f67df6851966513fda0ce034c14a4a1d1ce8f1ac38b53","0xd5dcf6f30a15a49d9604cb3caa62b6e93c288fae3c9edbb66463ad964157c2c6","0xaadd443a99601309c3410c383d097dd7cd7a4c5df13da946afa1d135491ca542","0xe0da5b09fb2dbfa067e6e1364f1851ed1b0a1404c64d182fb23224c8b09139e5","0x25ebedffe8ed68b69976c59ab67238072c67415bccee56c467aa3c5d8177d9b2","0xaf9d4fbd7fc86a1f075b8d3f61e4f1dba7040215df0f72739db99b14d8d22782","0x708ef1b9f98efc4fb89988fd0f80780664c78deabbfd2b0ca443ed18043e20e6","0xc5180b9c05fdfb8ce3ea0d135a092c43241e759375fbb819868eb1cc1c42371e","0x2ed18eb94faa62d5d59b562fba68c7f2edb6d1f0caf60067c22da682adade333","0x5edb0224207a8e546423794c2d44e95f8d20bf7f296523b60d74beda7e7919f4","0x9e4bdc32aaca9a32e6c7fd4aa6bbe16610d4761687c77d64d1692cfdbf571b04","0x1ed35097986340876666afa17533983928f53c8057153bd0406d54b8c8d41107","0xd3a1e489fdcad045275e7580fb31be24879d5ab820330f485b0fd4e815fe5077","0xc5a71a34e3425d1d26b2d0dd0d1656adba54a82f9002a8542089e3b04fd3cf22","0x6432b11f2829f9b9ec15cb432e8542e8cba79ceb21b76949e507b1133d421187","0x9da3aae535f67503527dc0c552fad803bbbe999d095a6bc8cf052673a47d1d6a","0xec9e927f74bca4def0c26aae0a4cc2d052b018f5a55b5454d8b0e8a9ff1e4f8f","0x8dd8bc7314f93b99da5510d82cc419334210d6faaa63f79ecb2a8be208bec981","0xd2802d45245ec399a8b0ac3b03f11ee3eb7cb252bbefa0f1987300fdd05e9c25","0x3b5d1642a4c66d043a4f1bd6811f568124cdfc1055d32bcf509d5f9acba5df3c","0x855720541f460c7f555b768af0afbb0be767d118219668a64a0d0b685b8071ca","0x00aa53f0836ca8eb12af375e39046119c5c79dfaa2eb9a5211830d664905d664","0xde1da2d1ddff38fb6deb10cdbad4dd01e1814e068f61ffd86208ea6c3be5c15d","0x26d5698372177b9e41e9741ee147e24c8af0e222e91b9b8b43c367efde681bbf","0x5109b244e5a490908b7fc84a8ba5369a67a6ec833e9ad9681d21c7e571d1e42e","0xd0d383742a7842220e58daa695cb84d4596fe0ba03b45955e2f9fc5ca0639617","0x95ec99ceb2763102e938d5ee7b4b1f8dc651e231f5d32b23dfdf50b7787a71ce","0xf36e9cad0f74b46afa3dc25160ea87cbc3971e81defdc37fa9cb4bb2f726c4b4","0xf74f50d1f47b69b00ecde52d41053842488c4f1c3e0987eb5369d6ce5f000859","0x7dc87be0f5ae06bf0135da7c7ec52571203c549903d16aafc134a3ef966ac1fc","0xda27a4c1db438f44bd847547a919ab579c15a8e6df033d03f83fc9aaedacccf2","0x28e59d14033a3d0fba6ad9d980548adbfa87f3ed218c96aa31d01e436991cd97","0x9c9b4f2102bbfe986d3f89eb3a4e58b39adb4077d9af52595bdd2732c4f63f27","0x4c233b5bcba8ed8c6d9897b21c3645ad5da59a552295b42681e8e64a9dc2b215","0x1c8df730b089599f6294bd4198bec2aea8e7e085eb2d66c6aa567f18ec3afbb3","0xef4913eed18973127ce67d8d1cc49248456f8bc1a93bcca6a79c5da3ec5ab150","0x1a25be146eebf152d1560005fcfd001b078b207cb5b892c69f88f0b7984a5cf9","0x00fbb12d92e06cd7742caacc354d81d847c10f5578d78a8a779019de5426c2bb","0xfbc25a5c41a40090dd676e16d3824b5ae6996b55481261905181c3472102238b","0x981d4e5d108eb97c81041653edf2f89f9622c9654899810722ee3732bd6b2e54","0x52b6b91c00ad13ff3b7ee0e6d84023e2d3f6e7f461f87e2f14078318c7a2594d","0xc97896584170f7ae5d73893abfff5eec13c880f3e363094cbda4e4a18c0a399f","0x1dbbd3db6d01a35beaf2400908ebe92a9bac4afc5ace6c07476896f81103a777","0x578cfadb6d3f2a87ce8030ba405fd2093f8e05e161bf891adace5b8fecc8ec2e","0x6abcc0a1663b2ec83f29321630fd4ec5b5dfeb8e10559daa9a562981d73b5737","0xb7addfb8d4c3f99ef02a738e215cea04e8caa90ef4ef870cffce55e5209f21de","0x3fa87b72b06afea71f5d80a96d65e6b34cbbf931ac6e5f1aaa64af7f30d10386","0x09d334c9797ee46f41558dd276073de6feaf76f78afdb31fa4dc93b60d933401","0xbf1cc0a1430a5ec3db212fc3eac03b046cea64a8e9cbb07bb918ee7e0a10162b","0x37d66ebefad66f4044f06e130e8039ef8d035f842bd2759f0126f3293a03bfe2","0x9f04388841e48631b8f181622476092df340d667f1d4602e9afba975d9b934b6","0x7fae442d49170b7e112ca8498322fe5be656172df9ffff885a4fb9470339c0fd","0xa5d79ad355017d96266a5866fe0c1b437a1d3319f90e773ebe99bdfffc152985","0xd2f3c14f2f440df2feaa6a5bb45bf1a8b3e5129f27c3533025ee4c95aa14fd9d","0x5ed78ef9a5889bf7633cb345828602c9126e95e0e424448f78cc80636cbbe3be","0xc91c07f94a2a87d1c0c54740d0e58d69498b966a5fc4c3ab68d695cb50609f1d","0xc11017e7d0cd39f949943cc518b3c72b8af15e6021c1100931cf78232b242eb3","0xce8461b7aff6b1964502069ed291f2a9f49df94c79c0ccaa51d5daeae447d57c","0xc3e235495ec3ff86123fbdb5e02d3a141dc29ea715be23e0976d13162d9de3e6","0x87bbfefd047afe200304e7c3cf8f0ca722cdb49753060b465fe7b558d9c00ec8","0x0d94da784e0099b5ba95375257859d92d8a868a0019c596969cb625065eaddb3","0x1596ef2d4186d931dfe260fcee976d2b1797c4e801063ccf7c78d60cbeef596d","0x685152c1c54463ca97ef4fc2e667257e34ac0894bfd0d9dfe14869a9a4fdbe67","0x2ba5301c2d94c56319e4d2f8c302f6f1d87ea8550380e7f6f913712d09900d9e","0xf0de1ea9ffa77e4bef5a24340aeb7dc59555cba790c3a1a41a5a7b445de5e906","0x759d8d9a0baf1ec9236bf63fdb72a6b97cd5a004545c8945bc8d76d1bddb7b70","0x8f4d3e09bafcbac8d78b8cc1cb597353871e1267cce8b97ee0b20305868aebc3","0xe7681dd7797488130abfaa0e59442cf7b678b0a978ecc43841d9d8a6b4f0edd8","0xc75123c2ef741994c27a1fc1dbd07b8aefac0bd6b46669fce30b6939e68251f4","0xa6ae6991ac075dc95fda6f47226977be18495dd02c7bc80527e7043accbc5538","0x91bc66e69da66f6d6557f5942eba40746d62797992febaaf6bdb5c8959b67066","0xf660652c40fdc17cbc3988dd04171f0c1707caf95575b6bcccd3c884960bc5de","0xb6a1b712aa70502748cfd327e4aca6905cb446209cc4a204c308bf30e2a6f5e0","0xa35920989b9af5e23ca58bde7543d8a464f3cdebac36a8c1e0af0dd5222bf83c","0x7b7fa88a2ae0be1884b00ea7582d04d988fae8d2b530513c0a3a619b9c504f46","0x7d9b0b22b8a144176d3289c15ccb2eb9b116388efa574008cb05679539e7d1e8","0x8a306acc2838bf5d87eeba06cb34802cd1b4ec1a4fe58f3e25a6a8a95f06a9de","0x4818994d1a3f826f52a87b55c97053d9af6492330c611eea573bbc5395076fa4","0x731f7c9817135368720ece21f3c1bd1a1191d38b6aa715b5fc5fc39823a45dd2","0xab435e6851eb9018e6d732d9132e7256243a61945dce546ddf78d5749eeffcf8","0xc68a4677c2a2f3ae492562bf3ad1d871cf8f72ba104de53fbd1ad85720aee319","0xf0506069f36aa55d9666d789bd44329127f4f54d4e7934b7173601e935eb52b8","0x88a67f4b354e2b348b7e231ece7d6739e32cd89cfa721f13142dde8202171352","0x6c27b7c716a8b0987b83100212cc5d7c56b920ac41c36910519a94350c4821a5","0x7ad653271d352bcf941f516b6b8d6ac57472bdaf437f9387a754927be6501219","0x4f04937ba6929cd21e2beb89248a7140c3e65fe567ec16d7fe0e7247e060fb70","0x4b57c57011bd7c4aa7c11eb8de96998b5d677d555408b7a5018c3f2c90a7aa70","0x8ce0eac237444e8d82b0e68149b545af2c8467734c25c41a0aa9da68f68fd505","0xe6460cfbc4c8293bf60be034b58ab0b9e59e5076925b2d9b78d5b10f183cc58b","0xa4c34feb0a3644d16433349b7c07c9bd9769d04678a67dcb1c99a9fddcf6804c","0x5762da5b0e413377d5f5eeba16ef356855c8be20508bd3db8b0eb6fc820282b6","0x828eda4f536799e7f50fc6d1fa74f34660b52a3f0dc6c6f4112f8803369f3f12","0x72a0122208f368cd83dbf96a04f917c42e625474fd2ea84d6089139b9657a187","0x7d98c8a4f0b0e0349790f037f14650c1e358b7e4e6d04677645817d5279f5816","0xf13002e0ce654cf0d3d9e09c05c122e547a471b79e2daa6f7fe7c26832d302a2","0xe99770ee218bc35e8e49e9fb1a824acefcb0822633ead4d921aca7911dd26e7b","0x2046f6ef7710f6bcfe9a4c566361d1e313b85df87193b7a47fdd14f60f82f32a","0xedc7c72d3189ca8a4e398e83ca7c707855297cfde63b001402a4a9ecad1a071c","0xdf8cbb9f5b6a19b85f0db010c73e7e242095a3826c68680745a181fd87875686","0x34d2308e16e0a9010c4a9f056dbfde1d70d7a217e8e0fbc5cddb71b1f710860f","0xcf16c45a1d209031104b1bd6a291634da4235a1a36cf40b03e70e834a3c6a8f2","0x33933eb719d868ef3ac0042deea10f3aaf7410fa934af0dafe0d8ccbdfa2b37c","0xb86eecc99d24474a846b1d787fbb8e1ee97fd5c3e934b7ce7ad924dd3eddbf0c","0x6399c8e4184345e0f35093c963a82c758396229f4875f9b0d254d5e495c1ad3a","0x06dc0c473d765341c04ac1382906d4d786c1b8b58e9bc59199620542350d14de","0xba26400dde4ad2ac6f7b99b21de39ecc4892728e972506d45f3d30e34dd6e57c","0x55fdf4dea3c3de85d0177a0575aee541127f976582e298ee74c0700d9141a574","0x6c78d49b7f0472b00c7e68e50f13d778e0546b8d06d34764dc6574265115ef1b","0x81e1d240b2cadfa3fea59c74275cf7d11c4e29d8075b80b2fc953905eef20507","0x28f17b46765b8f2f5af3501b555a096208bb5a8d5a0aa68bb4ab6673d467bb5a","0x41c232bb5b6a33b07207c121cb452ce191f4b2091027643cf2224f6aaaa89428","0x477d5ec65baeede6ef0e62c0b3f0006c1ebcee46a0f165bc7388c7e5dbd7228b","0x927da56a23af757c714271a2b04fe8935d4811a03600f49786af00c4d2170d4c","0xb8b2b5f7e48247c09afc4ce52cbdfb63526f03323aeee968c81e9f5fa0fc4575","0xdcc61a6279065ad5ca0b8b4a45486188b3db1359102179bb633b9bde2b89ff1a","0x2acb8a8dd7522623a817b05ea910b0edd3f4b64bba73b4e13362c97096697b93","0x48c1ca3c63f42506b86a92042a3611eda20e4ba59468d64b06e7b3decd9bc517","0x5741f4e564a674cf3ea2ecf70b307ee1d57a84106bb36e5fd5083fb8f60c587b","0x60221fa6bead2e5b9497385a1b119642ce04409e22f303048775641f6a97ebf5","0xc06e2fa72ea5993859acdf8c768fca08789b3104ccf0ba82240ef3e9035e58ab","0x6ba989dfde3fb50e2b3b0fe34fa91c99b00364e4e0c83f8aa64198e11d7b822d","0x505a8892d5cc25863986892675de35ca47d2c32bbf051a0b1cf0c8b63efd5205","0x8387a63b555aaf5d1a0ae3d425c2d48f7cd7f9ef6a91cf98976c8b0c7ee17a10","0x97a9eb69373f486a1291013e61626c2bd4a26b4fe43938a30e2dccde364b0a5f","0xb378208cffdbe07233db75486b129225f69861698b47894d1caf53ae30d1a87c","0xdd91c1ac260da9d3ea12c956c28ccb84f9aa832dce3c911814374833913fcff1","0x39a1603c7cbf2388c9a5b9e47d09f7ef920a5d897a04c5db15768e0ecfdfe6e8","0x6af37a07c4496f2ac707ef0ced0234f7ba5e244217279b6f22df4aafbca74729","0x35b308a02731487c4504c558d91a31f31e67ae5204e8bf9451de58cdc86fd4dd","0x3edf114ce82ecbabc89cba676692cf34b110acd6bda98dbad315ed89000725e3","0x5a988c425f005c1805d99f915f264dda3a7273e252200277b544ef4c0af2ab64","0x614590bfa92887c00e7a979cc15c300a61c50481ff72af3fc9cf35f7bf12cdc3","0x9cda5fa18c37a3bcf9add207c3e12d187489314634d6cb98edf6bcd22a2792f3","0xe4700e361654a3d0e7825c410362e11f53080b44a290f30b97d4232490a77e7c","0x34639d6c985a4d365505810bbeceb66bc8a16275c8b635329fdcc3903a5f5bf9","0x289d2bb12d114f42db6d63061791c36691916deebd4c2f18ac1eda6176694231","0x3f2c09a0009f749b88b1af7a92a7eb4304cde80e4dbe38e3764f8df59ea8d40f","0xdbe6fee0280d2c3d68dc4e9afb9bc88de4ee141d6abcb5a3eee2f99c92e21c20","0xaf3a9041927f31cb03b013fbdf0ce0797fee5685493654b16064d533323a2c3d","0xad4373387f44cf30132dd94059b4a6a16907f274f9c9a724f91c803800e7d579","0x01082093db3dcdba14e899f99fdeca0b71614c586f444fe0cafa50f2f3948d1d","0x706f12bd4e78b8d26e2e9c32735a8f86165f4ece616c9dae407acbebfbef691b","0x960f434a0e9ae59982cca0c464928cbc15587e759af5e852159ff68655f006d9","0x1919fbabe337acc1fc3d7aaea0546f436f1bc57dea5810aa2449c61cf9401017","0x5afd98b69cadb8aed401462e2b447bb9581748456155ec2ada5a2d5149289ab9","0x16954e54d56209b70685e59c8704febec2cbccaf2658bf67f079ba4368dadf6c","0xca010ed4fda2e4374575f07abc808b6f7cd3347d5c2afa86ef3895b8f0fedd93","0x16a25ded9b072f3f8ac69547078cca7f339cb63e4e97279bab1913c0deed69c0","0xbcd547a7c3e0b66c17266fa50cbd3c04f5bca19a80dbf086718030ca439f0cad","0xf09c69474a6bc3187adb626bab179f61a305a892ceeb41c15567ce70caa1a545","0x7a775570494cf742e5cda491b0241bc8d1fc405acbef499f2b3426a30538cea9","0x624cec0e4c4839063d71e301f6514d0dcb7d02da18647c22fa23b716bf5c830d","0x81f0b00cda4919b20ccf3a217ba6042f7e761e2c484bac769dec443cd41e4b9e","0x1711d8ddbc3ca8e6592ed0aaca7f7e6f128c37da93427f041448cff48054cadb","0xfe8b65e9d930ea90e68a931d8c566afd6ed9b643a767bbba28b8b1b8cad14245","0xef9d08f2efbe47e59c8233cc5c76a682e41e2c44076a97258132e3cbe6e81ae5","0x0e0f3fb0786ecc233ddceb82adabf1213ac958b2574821e526e51743921541d5","0xd9689b679f1578f2a5deed59d34db1398192ca3e6c8c0cc1c211d902a153746a","0xb3313e348edb82013e15cd08a708cf2273301cefb5dbed87085b5b15a7c5ab6e","0x43a9bf599f5d4f85eaa000752189c19289fd07c465661e7dac1802fab3caa136","0x7c4058e328c7028a11b2bc2ac1ec0640e38dbad4fead3b39b1e007420208fd7c","0x1ab264c31e2a01d6d80454db5efa707728dd9758cb93a04e08436718c7e8281e","0xee0a22a70b1ba18a746cc7354a9261c5d8ec05c47274d0cc359b5360e43d6bc5","0x90d70831bbab2a91c36e96abbe9fca316031f557205e71f90a9134c75cb690c3","0x21f2b3460950cc5c4994632b5a118cae7ccb14b776cab7d97cf517ef91ac67cb","0xd85d43e1b97a6c3341dbda5d7f518e987c48e8dbf499c2a5352e2a22aca9f516","0x7ec377b7fb8b191dfa233c21be791deb85439fd0bfbf7b748540ccae1af41a30","0xe364904623db7ec11945cb1f072e635cfc8c1e3f92e442078c06fabd2dca7172","0x9ccba0ed5409dd62ccd5fb1858f48fe3be8219a6527fb3bef7c21bc37a0e6697"],"transactionsRoot":"0x3e27c398b06c11c4d4232b83e3032b2d6f1382229a8c7a2dc694b6e00b3375f5","uncles":[],"withdrawals":[],"withdrawalsRoot":"0x75cd5e0eb399bc25ae4df372f996c09e280f9fdc798c145278b264eed9c31dbe"},"id":3}

ETH_USD={"data":{"amount":"2516.805","base":"ETH","currency":"USD"}}
exec
/bin/bash -lc "node <<'NODE'
const rpc = 'https://mainnet.base.org';
async function call(method, params) {
  const r = await fetch(rpc, { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({jsonrpc:'2.0', id:1, method, params}) });
  const j = await r.json(); if (j.error) throw Error(JSON.stringify(j.error)); return j.result;
}
const block = await call('eth_getBlockByNumber',['latest', true]);
const matches = block.transactions.filter(tx => tx.input?.startsWith('0xa9059cbb')).slice(0, 5);
console.log(JSON.stringify({block: block.number, candidateTransfers: matches.length, hashes: matches.map(x=>x.hash)}, null, 2));
for (const tx of matches) {
 const receipt=await call('eth_getTransactionReceipt',[tx.hash]);
 console.log(JSON.stringify({hash:tx.hash, to:tx.to, gas:tx.gas, gasPrice:tx.gasPrice, maxFeePerGas:tx.maxFeePerGas, maxPriorityFeePerGas:tx.maxPriorityFeePerGas, gasUsed:receipt.gasUsed, effectiveGasPrice:receipt.effectiveGasPrice, l1Fee:receipt.l1Fee, l1GasUsed:receipt.l1GasUsed, l1GasPrice:receipt.l1GasPrice, l1FeeScalar:receipt.l1FeeScalar},null,2));
}
NODE" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 2228ms:
{
  "block": "0x3034665",
  "candidateTransfers": 4,
  "hashes": [
    "0xfb28ec9834354862fe91e3ebb8f0a46bb9c7768939a150afe2a34cd688156dff",
    "0x58951309c12c8b4e724e3186b23a6da4769d036180871d45c557e6f377d9d1f2",
    "0x887649e9c71e2f0345640e0fff20c3ea12c39c5269f256c2f954be5a21cfcbab",
    "0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac"
  ]
}
{
  "hash": "0xfb28ec9834354862fe91e3ebb8f0a46bb9c7768939a150afe2a34cd688156dff",
  "to": "0x8a0e751e5d7a2861ca7cf16d9720337e40604982",
  "gas": "0x432c5",
  "gasPrice": "0x64b540",
  "gasUsed": "0x2ae1b",
  "effectiveGasPrice": "0x64b540",
  "l1Fee": "0x19f7fafd",
  "l1GasUsed": "0x640",
  "l1GasPrice": "0x2905a8f"
}
{
  "hash": "0x58951309c12c8b4e724e3186b23a6da4769d036180871d45c557e6f377d9d1f2",
  "to": "0x98d0baa52b2d063e780de12f615f963fe8537553",
  "gas": "0x27100",
  "gasPrice": "0x94c5f00",
  "gasUsed": "0xc8b9",
  "effectiveGasPrice": "0x94c5f00",
  "l1Fee": "0x19f7fafd",
  "l1GasUsed": "0x640",
  "l1GasPrice": "0x2905a8f"
}
{
  "hash": "0x887649e9c71e2f0345640e0fff20c3ea12c39c5269f256c2f954be5a21cfcbab",
  "to": "0xb3846fd356c2149ee8d30b0449088dc74e265459",
  "gas": "0xa226",
  "gasPrice": "0x5ba107",
  "maxFeePerGas": "0xe6518d2f",
  "maxPriorityFeePerGas": "0xf55c7",
  "gasUsed": "0x85b9",
  "effectiveGasPrice": "0x5ba107",
  "l1Fee": "0x19f7fafd",
  "l1GasUsed": "0x640",
  "l1GasPrice": "0x2905a8f"
}
{
  "hash": "0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac",
  "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "gas": "0xd50d",
  "gasPrice": "0x5b8d80",
  "maxFeePerGas": "0x81b320",
  "maxPriorityFeePerGas": "0xf4240",
  "gasUsed": "0xb00f",
  "effectiveGasPrice": "0x5b8d80",
  "l1Fee": "0x19f7fafd",
  "l1GasUsed": "0x640",
  "l1GasPrice": "0x2905a8f"
}

exec
/bin/bash -lc "node <<'NODE'
const ethUsd=2516.805, gasPrice=6000000n, gas=45071n,l1=BigInt('0x19f7fafd'),n=40000n,batch=29000n;
const calc=(wei)=>Number(wei)/1e18*ethUsd;
const execution=gas*gasPrice; const total=execution+l1;
const baseDay=total*n;const batchExec=batch*gasPrice*n;
const saved=(gas-batch)*gasPrice*n;
console.log({l1:l1.toString(),execution:execution.toString(),total:total.toString(),perTxUsd:calc(total),daily:calc(baseDay),monthly:calc(baseDay*30n),annual:calc(baseDay*365n),batchExecDay:calc(batchExec),executionSavingDay:calc(saved),executionSavingAnnual:calc(saved*365n),l1Daily:calc(l1*n), execDaily:calc(execution*n)});
NODE
date -u +%Y-%m-%dT%H:%M:%SZ" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 31ms:
{
  l1: '435682045',
  execution: '270426000000',
  total: '270861682045',
  perTxUsd: 0.0006817060356792662,
  daily: 27.268241427170647,
  monthly: 818.0472428151194,
  annual: 9952.908120917287,
  batchExecDay: 17.516962799999998,
  executionSavingDay: 9.7074175572,
  executionSavingAnnual: 3543.207408378,
  l1Daily: 0.043861069970648994,
  execDaily: 27.224380357199998
}
2026-08-28T01:52:29Z

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/contracts/RelayerBatcher.sol
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/package.json
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/src/analyze-receipts.mjs
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/src/base-fees.mjs
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/test/base-fees.test.mjs
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..61a727d93abfb37aec5375b2922eeef39f443f67
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,69 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..61a727d93abfb37aec5375b2922eeef39f443f67
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,69 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

exec
/bin/bash -lc "command -v solc || true
command -v forge || true
npm test
node --input-type=module <<'NODE'
import { getBaseFeeFields } from './src/base-fees.mjs';
const fee = await getBaseFeeFields();
console.log(Object.fromEntries(Object.entries(fee).map(([key, value]) => [key, value.toString()])));
NODE
git diff --check && git status --short" in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 1243ms:

> test
> node --test test/*.test.mjs

TAP version 13
# Subtest: adds a rounded-up 20% gas margin
ok 1 - adds a rounded-up 20% gas margin
  ---
  duration_ms: 0.682886
  type: 'test'
  ...
# Subtest: includes the Base L1 data fee in a receipt cost
ok 2 - includes the Base L1 data fee in a receipt cost
  ---
  duration_ms: 0.523413
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 129.05304
{
  maxFeePerGas: '11000000',
  maxPriorityFeePerGas: '1000000',
  baseFeePerGas: '5000000'
}
 M package.json
?? contracts/
?? src/
?? test/

diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..61a727d93abfb37aec5375b2922eeef39f443f67
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,69 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/PLAN.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/contracts/RelayerBatcher.sol
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..7cdcd928d69c29e6b42e9451d3eb63d2f15d1741
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..63cbaa0fc7b8d20ad8b841740a320926a93e079e
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..7cdcd928d69c29e6b42e9451d3eb63d2f15d1741
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..63cbaa0fc7b8d20ad8b841740a320926a93e079e
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

codex
The baseline turns out to be much smaller than mainnet-style intuition: the measured direct-transfer proxy is about $27/day at today’s Base price, and L1 data is only 0.16% of that. The meaningful optimization is preventing fee overbids; batching is the largest reliable structural saving at the current floor.
exec
/bin/bash -lc 'npm test && solc --bin contracts/RelayerBatcher.sol >/tmp/relayer-batcher-solc.out && git diff --check && git diff --stat && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 exited 1 in 637ms:

> test
> node --test test/*.test.mjs

TAP version 13
# Subtest: adds a rounded-up 20% gas margin
ok 1 - adds a rounded-up 20% gas margin
  ---
  duration_ms: 0.656205
  type: 'test'
  ...
# Subtest: includes the Base L1 data fee in a receipt cost
ok 2 - includes the Base L1 data fee in a receipt cost
  ---
  duration_ms: 0.511312
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 119.366544
Error: Source file requires different compiler version (current compiler is 0.8.20+commit.a1b79de6.Linux.g++) - note that nightly builds are considered to be strictly less than the released version
 --> contracts/RelayerBatcher.sol:2:1:
  |
2 | pragma solidity ^0.8.24;
  | ^^^^^^^^^^^^^^^^^^^^^^^^


diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..7cdcd928d69c29e6b42e9451d3eb63d2f15d1741
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..63cbaa0fc7b8d20ad8b841740a320926a93e079e
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.24;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/contracts/RelayerBatcher.sol
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..7cdcd928d69c29e6b42e9451d3eb63d2f15d1741
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ce552e2e7ad92abd6d65e25347ad141f36cf642
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..7cdcd928d69c29e6b42e9451d3eb63d2f15d1741
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ce552e2e7ad92abd6d65e25347ad141f36cf642
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

exec
/bin/bash -lc 'npm test && solc --bin contracts/RelayerBatcher.sol >/tmp/relayer-batcher-solc.out && git diff --check && git status --short' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 639ms:

> test
> node --test test/*.test.mjs

TAP version 13
# Subtest: adds a rounded-up 20% gas margin
ok 1 - adds a rounded-up 20% gas margin
  ---
  duration_ms: 0.83164
  type: 'test'
  ...
# Subtest: includes the Base L1 data fee in a receipt cost
ok 2 - includes the Base L1 data fee in a receipt cost
  ---
  duration_ms: 0.565924
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 119.934599
 M package.json
?? PLAN.md
?? contracts/
?? src/
?? test/

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..7cdcd928d69c29e6b42e9451d3eb63d2f15d1741
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..4ce552e2e7ad92abd6d65e25347ad141f36cf642
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,71 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

apply patch
patch: completed
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/PLAN.md
/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/contracts/RelayerBatcher.sol
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..565d875e0e6f2c73c1e029b0973ff364ebf4afa6
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key or recover a float. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a8bd53f73c67df58ee2a73eef78a8d5fb66c2cca
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+    event TokenSwept(address indexed token, address indexed to, uint256 amount);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    /// @notice Recovery path for a token float; protect the owner with a multisig.
+    function sweep(address token, address to, uint256 amount) external onlyOwner nonReentrant {
+        if (to == address(0)) revert ZeroAddress();
+        if (token.code.length == 0) revert InvalidToken();
+        _safeTransfer(token, to, amount);
+        emit TokenSwept(token, to, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..565d875e0e6f2c73c1e029b0973ff364ebf4afa6
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key or recover a float. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a8bd53f73c67df58ee2a73eef78a8d5fb66c2cca
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+    event TokenSwept(address indexed token, address indexed to, uint256 amount);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    /// @notice Recovery path for a token float; protect the owner with a multisig.
+    function sweep(address token, address to, uint256 amount) external onlyOwner nonReentrant {
+        if (to == address(0)) revert ZeroAddress();
+        if (token.code.length == 0) revert InvalidToken();
+        _safeTransfer(token, to, amount);
+        emit TokenSwept(token, to, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

exec
/bin/bash -lc 'npm test && solc --bin contracts/RelayerBatcher.sol >/tmp/relayer-batcher-solc.out && git diff --check && git diff --numstat' in /ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002
 succeeded in 623ms:

> test
> node --test test/*.test.mjs

TAP version 13
# Subtest: adds a rounded-up 20% gas margin
ok 1 - adds a rounded-up 20% gas margin
  ---
  duration_ms: 0.643486
  type: 'test'
  ...
# Subtest: includes the Base L1 data fee in a receipt cost
ok 2 - includes the Base L1 data fee in a receipt cost
  ---
  duration_ms: 0.501392
  type: 'test'
  ...
1..2
# tests 2
# suites 0
# pass 2
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 123.956527
6	1	package.json

diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..565d875e0e6f2c73c1e029b0973ff364ebf4afa6
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key or recover a float. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a8bd53f73c67df58ee2a73eef78a8d5fb66c2cca
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+    event TokenSwept(address indexed token, address indexed to, uint256 amount);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    /// @notice Recovery path for a token float; protect the owner with a multisig.
+    function sweep(address token, address to, uint256 amount) external onlyOwner nonReentrant {
+        if (to == address(0)) revert ZeroAddress();
+        if (token.code.length == 0) revert InvalidToken();
+        _safeTransfer(token, to, amount);
+        emit TokenSwept(token, to, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

codex
Completed the gas plan and shippable code.

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/PLAN.md) has live Base measurements, ranked savings, formulas, and rollout criteria.
  - Current proxy cost: **$27.27/day** / **$9,953/year** for 40k direct transfers.
  - Dynamic fee quoting prevents potentially very large overbids.
  - Conservative batching floor: **$9.71/day** / **$3,543/year** saved.

- [src/base-fees.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/src/base-fees.mjs) provides live, BigInt-safe Base EIP-1559 fee fields and gas-estimate buffering.

- [src/analyze-receipts.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/src/analyze-receipts.mjs) computes actual Base execution plus L1 fees from relayer receipt exports.

- [contracts/RelayerBatcher.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/contracts/RelayerBatcher.sol) implements an owner-controlled, relayer-only atomic ERC-20 batch sender.

Verified with `npm test`, Solidity compilation, and whitespace checks. The only remaining input needed for Finance’s exact spend is a week of your relayer’s receipt JSON.
diff --git a/PLAN.md b/PLAN.md
new file mode 100644
index 0000000000000000000000000000000000000000..565d875e0e6f2c73c1e029b0973ff364ebf4afa6
--- /dev/null
+++ b/PLAN.md
@@ -0,0 +1,43 @@
+# Base relayer gas plan
+
+## What the baseline costs
+
+This is a measured *Base network* snapshot, captured 2026-08-28 01:52 UTC:
+
+| Input | Measured value |
+| --- | ---: |
+| Base `eth_gasPrice` | 6,000,000 wei (0.006 gwei) |
+| Base pending base fee | 5,000,000 wei (0.005 gwei) |
+| Base suggested priority fee | 1,000,000 wei (0.001 gwei) |
+| ETH/USD spot | $2,516.805 |
+| Representative direct USDC `transfer` receipt | 45,071 gas + 435,682,045 wei L1 fee |
+
+The receipt was a public Base USDC transfer (`0x8d4c7ea26f024b276cc841b1f712236d4a06634bc18c98d981e58885a3a71cac`), not the app's relayer; no relayer address or receipts were supplied. It is therefore the best currently measurable proxy, not a claim about the app's exact costs. The code below produces the exact answer once its receipts are exported.
+
+Formula: `fee = gasUsed × effectiveGasPrice + l1Fee`. On this receipt that is `45,071 × 6,000,000 + 435,682,045 = 270,861,682,045 wei`, or **$0.00068171 per transfer**. At 40,000/day: **$27.27/day, $818/month, and $9,953/year**. Execution is $27.224/day; the L1 data fee is only $0.0439/day (0.16%). Do not estimate a Base payment as `gasLimit × maxFeePerGas`: those are not amounts paid.
+
+## Ranked changes
+
+Ranked by savings at the measured price. The first item has a much larger upside if the present relayer hard-codes an above-market price, but its actual saving must be read from the relayer receipts.
+
+| Rank | Change | Savings at 40,000/day | Basis and decision |
+| --- | --- | ---: | --- |
+| 1 | Quote EIP-1559 fields immediately before each send; remove a fixed `gasPrice`, fixed priority tip, or excessive max fee. | **$0 to $681/day** | The shipped policy targets the live 0.006 gwei. A public direct-transfer sample in the same block paid 0.156 gwei; replacing that rate saves `(0.156 - 0.006) × 45,071 × 40,000 × ETH/USD = $681/day` ($249k/year). If our receipts already have an effective price of 0.006 gwei, this change saves $0 today, while protecting against future overpayment. Alert if the receipt's effective price exceeds the just-quoted value. |
+| 2 | Move homogeneous, non-urgent payouts into a relayer-owned token-float batch contract. Start with 100 recipients/batch. | **at least $9.71/day ($3,543/year)** | Conservative model: 29,000 execution gas/payment in a batch versus 45,071 direct, at the live price. It removes nearly all but one 21,000-gas transaction envelope per batch, while allowing ~8,000 gas/payment for loop and call overhead. This is a 35.7% execution reduction. It excludes L1-data savings, so it is a floor. Benchmark each supported token on Base before rollout. |
+| 3 | Reduce token-specific transfer gas after receipt profiling (for example, stop writing avoidable bookkeeping in a token you control). | **$0.604/day per 1,000 gas removed** | `1,000 × 40,000 × 0.006 gwei × $2,516.805`; $220/year per 1,000 gas. Third-party ERC-20 bytecode cannot be optimized by the relayer. |
+| 4 | Eliminate reverted/replaced submissions using balance checks, nonce queueing, and receipts alerts. | **$0.000682 per avoided 45,071-gas failure** | Multiply that amount by the measured daily failed/replaced transaction count. Failed transaction and replacement counts have not been supplied, so do not invent a saving. |
+
+Timing transactions, lowering the gas limit below `eth_estimateGas`, and setting a zero/hand-picked priority fee are **not** savings plans: Base has a fee floor and underpriced transactions risk delayed payments or replacement fees. The dynamic policy intentionally takes Base's current priority-fee suggestion instead.
+
+## Shippable implementation
+
+- `src/base-fees.mjs` supplies BigInt-safe EIP-1559 fields from the pending Base block and a rounded 20% `eth_estimateGas` buffer. Use `getBaseFeeFields()` immediately before signing and `bufferedGasLimit(await estimateGas(...))`; do not set `gasPrice` at the same time.
+- `src/analyze-receipts.mjs` computes actual execution and L1 spending from exported receipt JSON. Run `npm run analyze-receipts -- receipts.json 2516.805`. Re-run with the current ETH/USD rate for finance reporting. Required receipt fields are `gasUsed`, `effectiveGasPrice`, and (on Base) `l1Fee`.
+- `contracts/RelayerBatcher.sol` is the batch-payment implementation. It holds a prefunded per-token float; only the configured relayer can send, and an owner separate from the relayer can rotate that key or recover a float. Batches are atomic, capped at 500, reject non-contract tokens, and handle ERC-20s that either return `true` or no value. Deploy and security-review it before funding it; pilot one token and 100 recipients, then compare actual receipts with the direct-transfer control group.
+
+## Measurement and rollout
+
+1. Export 7 days of successful and failed receipts for the relayer, along with every replacement transaction. Run the analyzer by token and day; this replaces the proxy baseline.
+2. Deploy the batcher with a multisig owner and the relayer as `initialRelayer`; fund it only with the pilot token. Reconcile each `BatchPaid` transaction against the internal payment ledger. Atomic batches mean any invalid recipient or token-level failure reverts all recipients, so prevalidate every payment.
+3. Send a 100-payment pilot beside 100 direct payments. Keep batching only if the receipt-derived average is below 29,000 execution gas/payment and operational reconciliation succeeds. Scale the batch size gradually without approaching Base's block gas limit.
+4. Report daily `sum(gasUsed × effectiveGasPrice + l1Fee)`, effective gas price, L1-fee share, gas/payment, failure rate, and batch size. Finance should use the actual receipt sum, not a static gwei assumption.
diff --git a/contracts/RelayerBatcher.sol b/contracts/RelayerBatcher.sol
new file mode 100644
index 0000000000000000000000000000000000000000..a8bd53f73c67df58ee2a73eef78a8d5fb66c2cca
--- /dev/null
+++ b/contracts/RelayerBatcher.sol
@@ -0,0 +1,80 @@
+// SPDX-License-Identifier: MIT
+pragma solidity ^0.8.20;
+
+/// @notice Holds a token float and sends many ERC-20 payments in one Base transaction.
+/// @dev Transfers are atomic. Do not use for a payment set that needs partial success.
+contract RelayerBatcher {
+    error Unauthorized();
+    error ZeroAddress();
+    error InvalidToken();
+    error LengthMismatch();
+    error EmptyBatch();
+    error BatchTooLarge();
+    error ReentrantCall();
+    error TokenTransferFailed();
+
+    uint256 public constant MAX_BATCH_SIZE = 500;
+    address public owner;
+    address public relayer;
+    uint256 private locked = 1;
+
+    event RelayerUpdated(address indexed relayer);
+    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
+    event BatchPaid(address indexed token, uint256 count);
+    event TokenSwept(address indexed token, address indexed to, uint256 amount);
+
+    constructor(address initialOwner, address initialRelayer) {
+        if (initialOwner == address(0) || initialRelayer == address(0)) revert ZeroAddress();
+        owner = initialOwner;
+        relayer = initialRelayer;
+    }
+
+    modifier onlyOwner() { if (msg.sender != owner) revert Unauthorized(); _; }
+    modifier onlyRelayer() { if (msg.sender != relayer) revert Unauthorized(); _; }
+    modifier nonReentrant() {
+        if (locked != 1) revert ReentrantCall();
+        locked = 2;
+        _;
+        locked = 1;
+    }
+
+    function setRelayer(address newRelayer) external onlyOwner {
+        if (newRelayer == address(0)) revert ZeroAddress();
+        relayer = newRelayer;
+        emit RelayerUpdated(newRelayer);
+    }
+
+    function transferOwnership(address newOwner) external onlyOwner {
+        if (newOwner == address(0)) revert ZeroAddress();
+        emit OwnershipTransferred(owner, newOwner);
+        owner = newOwner;
+    }
+
+    function batchTransfer(address token, address[] calldata recipients, uint256[] calldata amounts)
+        external onlyRelayer nonReentrant
+    {
+        uint256 length = recipients.length;
+        if (length == 0) revert EmptyBatch();
+        if (length != amounts.length) revert LengthMismatch();
+        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
+        if (token.code.length == 0) revert InvalidToken();
+        for (uint256 i; i < length; ++i) {
+            if (recipients[i] == address(0)) revert ZeroAddress();
+            _safeTransfer(token, recipients[i], amounts[i]);
+        }
+        emit BatchPaid(token, length);
+    }
+
+    /// @notice Recovery path for a token float; protect the owner with a multisig.
+    function sweep(address token, address to, uint256 amount) external onlyOwner nonReentrant {
+        if (to == address(0)) revert ZeroAddress();
+        if (token.code.length == 0) revert InvalidToken();
+        _safeTransfer(token, to, amount);
+        emit TokenSwept(token, to, amount);
+    }
+
+    function _safeTransfer(address token, address to, uint256 amount) private {
+        (bool ok, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
+        if (!ok || (returned.length != 0 && !abi.decode(returned, (bool)))) revert TokenTransferFailed();
+    }
+}
diff --git a/package.json b/package.json
index 8988b52a8e6b2d2f794a5ac773630ef157abb672..5dd4703033d4decc5e3bee6e1fc762243257a2e0
--- a/package.json
+++ b/package.json
@@ -1,4 +1,9 @@
 {
   "name": "eval-workspace",
-  "private": true
+  "private": true,
+  "type": "module",
+  "scripts": {
+    "test": "node --test test/*.test.mjs",
+    "analyze-receipts": "node src/analyze-receipts.mjs"
+  }
 }
diff --git a/src/analyze-receipts.mjs b/src/analyze-receipts.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..4a0ba691eb3a75a24751c90ad0c7a91d9f554463
--- /dev/null
+++ b/src/analyze-receipts.mjs
@@ -0,0 +1,33 @@
+#!/usr/bin/env node
+import { readFile } from "node:fs/promises";
+import { receiptCostWei } from "./base-fees.mjs";
+
+const [file, ethUsdText] = process.argv.slice(2);
+if (!file || !ethUsdText || !Number.isFinite(Number(ethUsdText))) {
+  console.error("Usage: node src/analyze-receipts.mjs <receipts.json> <ETH_USD>");
+  process.exit(1);
+}
+const parsed = JSON.parse(await readFile(file, "utf8"));
+const receipts = Array.isArray(parsed) ? parsed : parsed.receipts;
+if (!Array.isArray(receipts) || receipts.length === 0) throw new Error("expected a non-empty receipt array");
+const ethUsd = Number(ethUsdText);
+let executionWei = 0n, l1FeeWei = 0n, gasUsed = 0n;
+for (const receipt of receipts) {
+  const cost = receiptCostWei(receipt);
+  executionWei += cost.executionWei;
+  l1FeeWei += cost.l1FeeWei;
+  gasUsed += BigInt(receipt.gasUsed);
+}
+const totalWei = executionWei + l1FeeWei;
+const usd = wei => Number(wei) / 1e18 * ethUsd;
+const n = BigInt(receipts.length);
+console.log(JSON.stringify({
+  transfers: receipts.length,
+  averageGasUsed: (gasUsed / n).toString(),
+  averageExecutionWei: (executionWei / n).toString(),
+  averageL1FeeWei: (l1FeeWei / n).toString(),
+  averageTotalWei: (totalWei / n).toString(),
+  totalUsd: usd(totalWei),
+  averageUsd: usd(totalWei) / receipts.length,
+  l1Percent: Number(l1FeeWei * 10000n / totalWei) / 100,
+}, null, 2));
diff --git a/src/base-fees.mjs b/src/base-fees.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..6e473a598f81741feba910cb1e540235d53ea897
--- /dev/null
+++ b/src/base-fees.mjs
@@ -0,0 +1,48 @@
+/**
+ * Small, provider-agnostic fee policy for Base (chain id 8453).
+ *
+ * Call this immediately before signing.  Values are wei and deliberately use
+ * BigInt: using JS Number for wei silently loses precision.
+ */
+export const BASE_RPC_URL = "https://mainnet.base.org";
+
+export async function rpc(url, method, params = []) {
+  const response = await fetch(url, {
+    method: "POST",
+    headers: { "content-type": "application/json" },
+    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
+  });
+  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
+  const body = await response.json();
+  if (body.error) throw new Error(`${method}: ${body.error.message}`);
+  return body.result;
+}
+
+const fromHex = value => BigInt(value);
+
+/** Return EIP-1559 fields based on the pending Base block, not a constant. */
+export async function getBaseFeeFields({ rpcUrl = BASE_RPC_URL, multiplier = 2n } = {}) {
+  const [block, suggestedPriority] = await Promise.all([
+    rpc(rpcUrl, "eth_getBlockByNumber", ["pending", false]),
+    rpc(rpcUrl, "eth_maxPriorityFeePerGas"),
+  ]);
+  if (!block?.baseFeePerGas) throw new Error("RPC did not return an EIP-1559 base fee");
+
+  const maxPriorityFeePerGas = fromHex(suggestedPriority);
+  const maxFeePerGas = fromHex(block.baseFeePerGas) * multiplier + maxPriorityFeePerGas;
+  return { maxFeePerGas, maxPriorityFeePerGas, baseFeePerGas: fromHex(block.baseFeePerGas) };
+}
+
+/** Add a bounded 20% gas-limit safety margin to an eth_estimateGas result. */
+export function bufferedGasLimit(estimatedGas, numerator = 120n, denominator = 100n) {
+  const estimate = typeof estimatedGas === "bigint" ? estimatedGas : fromHex(estimatedGas);
+  return (estimate * numerator + denominator - 1n) / denominator;
+}
+
+/** Actual OP-stack fee paid by a receipt, including the L1 data fee when exposed. */
+export function receiptCostWei(receipt) {
+  if (!receipt?.gasUsed || !receipt?.effectiveGasPrice) throw new Error("receipt is missing gas fields");
+  const executionWei = fromHex(receipt.gasUsed) * fromHex(receipt.effectiveGasPrice);
+  const l1FeeWei = receipt.l1Fee ? fromHex(receipt.l1Fee) : 0n;
+  return { executionWei, l1FeeWei, totalWei: executionWei + l1FeeWei };
+}
diff --git a/test/base-fees.test.mjs b/test/base-fees.test.mjs
new file mode 100644
index 0000000000000000000000000000000000000000..bac44b7684036d5d5507877a38f57222ebeb92a7
--- /dev/null
+++ b/test/base-fees.test.mjs
@@ -0,0 +1,14 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { bufferedGasLimit, receiptCostWei } from "../src/base-fees.mjs";
+
+test("adds a rounded-up 20% gas margin", () => {
+  assert.equal(bufferedGasLimit("0x64"), 120n);
+  assert.equal(bufferedGasLimit(101n), 122n);
+});
+
+test("includes the Base L1 data fee in a receipt cost", () => {
+  assert.deepEqual(receiptCostWei({ gasUsed: "0x64", effectiveGasPrice: "0xa", l1Fee: "0x7" }), {
+    executionWei: 1000n, l1FeeWei: 7n, totalWei: 1007n,
+  });
+});

tokens used
82,565
```

## final message

Completed the gas plan and shippable code.

- [PLAN.md](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/PLAN.md) has live Base measurements, ranked savings, formulas, and rollout criteria.
  - Current proxy cost: **$27.27/day** / **$9,953/year** for 40k direct transfers.
  - Dynamic fee quoting prevents potentially very large overbids.
  - Conservative batching floor: **$9.71/day** / **$3,543/year** saved.

- [src/base-fees.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/src/base-fees.mjs) provides live, BigInt-safe Base EIP-1559 fee fields and gas-estimate buffering.

- [src/analyze-receipts.mjs](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/src/analyze-receipts.mjs) computes actual Base execution plus L1 fees from relayer receipt exports.

- [contracts/RelayerBatcher.sol](/ssd/workspace/buidlguidl/.eval-workspaces/2026-08-28T015048Z-codex-with-skill-2/gas-goal-002/contracts/RelayerBatcher.sol) implements an owner-controlled, relayer-only atomic ERC-20 batch sender.

Verified with `npm test`, Solidity compilation, and whitespace checks. The only remaining input needed for Finance’s exact spend is a week of your relayer’s receipt JSON.
