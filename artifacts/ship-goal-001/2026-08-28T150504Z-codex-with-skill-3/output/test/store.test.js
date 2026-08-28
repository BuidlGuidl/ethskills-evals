import test from 'node:test';
import assert from 'node:assert/strict';
import { reliability } from '../src/store.js';

test('reliability counts completed loans and late returns',()=>{const m={id:'m'};const r=reliability(m,[{borrowerId:'m',status:'returned',lateDays:0},{borrowerId:'m',status:'returned',lateDays:2},{borrowerId:'m',status:'active',lateDays:0}]);assert.deepEqual(r,{loans:2,late:1,score:50})});
test('new members have no manufactured score',()=>assert.deepEqual(reliability({id:'new'},[]),{loans:0,late:0,score:null}));
