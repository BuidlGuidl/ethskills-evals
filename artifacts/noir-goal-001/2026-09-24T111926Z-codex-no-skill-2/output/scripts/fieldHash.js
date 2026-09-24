const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const C0 = 1234567890123456789012345678901234567890n;
const C1 = 987654321098765432109876543210987654321n;
const C2 = 192837465564738291019283746556473829101n;
const C3 = 918273645546372819009182736455463728190n;
const C4 = 112233445566778899001122334455667788990n;
const C5 = 998877665544332211009988776655443322110n;
const C6 = 314159265358979323846264338327950288419n;
const C7 = 271828182845904523536028747135266249775n;
const C8 = 161803398874989484820458683436563811772n;
const C9 = 141421356237309504880168872420969807856n;

function mod(x) {
  const result = x % FIELD_MODULUS;
  return result >= 0n ? result : result + FIELD_MODULUS;
}

function pow5(x) {
  const x2 = mod(x * x);
  const x4 = mod(x2 * x2);
  return mod(x4 * x);
}

function hash2(left, right) {
  left = mod(BigInt(left));
  right = mod(BigInt(right));

  let state = mod(left + right * C0 + C1);
  state = pow5(state + left * C2 + right * C3 + C4);
  state = pow5(state + left * C5 + right * C6 + C7);
  state = pow5(state + left * C8 + right * C9 + C0);
  return state;
}

function toBytes32(value) {
  return `0x${mod(BigInt(value)).toString(16).padStart(64, "0")}`;
}

module.exports = {
  FIELD_MODULUS,
  hash2,
  toBytes32,
};

