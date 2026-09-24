// Merges the individual measurement files into one data/measurements.json.
import { readFileSync, writeFileSync } from 'node:fs';
const read = (f) => JSON.parse(readFileSync(new URL(`../data/${f}`, import.meta.url)));
const network = read('measurements-network.json');
const fees = read('measurements-fees.json');
const sweep = read('measurements-sweep.json');
writeFileSync(new URL('../data/measurements.json', import.meta.url), JSON.stringify({
  generatedAt: new Date().toISOString(), network, fees, sweep,
}, null, 2));
console.log('wrote data/measurements.json');
