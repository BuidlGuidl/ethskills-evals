const solc = require('solc'); const fs = require('fs')
const input = { language: 'Solidity', sources: { 'SupplyAllUSDC.sol': { content: fs.readFileSync('contracts/SupplyAllUSDC.sol','utf8') } },
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'cancun', outputSelection: { '*': { '*': ['evm.bytecode.object','evm.deployedBytecode.object'] } } } }
const out = JSON.parse(solc.compile(JSON.stringify(input)))
if (out.errors?.some(e=>e.severity==='error')) { console.error(out.errors); process.exit(1) }
const c = out.contracts['SupplyAllUSDC.sol'].SupplyAllUSDC
fs.writeFileSync('contracts/SupplyAllUSDC.json', JSON.stringify({ bytecode: '0x'+c.evm.bytecode.object, deployedBytecode: '0x'+c.evm.deployedBytecode.object }, null, 2))
console.log('ok', c.evm.deployedBytecode.object.length/2, 'bytes')
