// Fork-only: broadcasts the batch WITHOUT the gas-estimate guard while the Aave leg is forced to
// fail, to show the swap leg is rolled back too. Never run this against mainnet.
import { createPublicClient, createWalletClient, http, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mainnet } from 'viem/chains'
import { METAMASK_7702_DELEGATOR, encodeBatchExecute, planEntry } from '../entry.ts'

const rpc = process.env.RPC_URL!
const account = privateKeyToAccount(process.env.PRIVATE_KEY as Hex)
const pub = createPublicClient({ chain: mainnet, transport: http(rpc) })
const wallet = createWalletClient({ account, chain: mainnet, transport: http(rpc) })

const plan = await planEntry(pub, account.address)
const authorization = await wallet.signAuthorization({ address: METAMASK_7702_DELEGATOR, executor: 'self' })
const hash = await wallet.sendTransaction({
  to: account.address,
  data: encodeBatchExecute(plan.calls),
  authorizationList: [authorization],
  gas: 1_000_000n,
})
const receipt = await pub.waitForTransactionReceipt({ hash })
console.log(`forced tx status: ${receipt.status}`)
