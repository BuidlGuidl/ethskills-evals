import { compareCosts, staticGasPriceWaste } from '../src/gasModel.js';

const report = compareCosts();
const staticAtPointOne = staticGasPriceWaste({ staticGasPriceGwei: 0.1 });

console.log(JSON.stringify({ ...report, staticAtPointOne }, null, 2));
