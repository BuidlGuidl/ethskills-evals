/** Tiny `--flag value` / `--flag` parser, so the scripts have no CLI dependency. */
export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

export function step(n, text) {
  console.log(`\n[${n}] ${text}`);
}

export function info(label, value) {
  console.log(`    ${label.padEnd(22)} ${value}`);
}

export function warn(text) {
  console.log(`  ! ${text}`);
}

export function fail(message) {
  console.error(`\nerror: ${message}\n`);
  process.exit(1);
}

/** Resolve a member's secret from --secret / --passphrase / env, in that order. */
export async function resolveIdentity(args, { Identity }) {
  const secretHex = args.secret ?? process.env.MEMBER_SECRET;
  if (secretHex && secretHex !== true) return Identity.fromHex(secretHex);

  const passphrase = args.passphrase ?? process.env.MEMBER_PASSPHRASE;
  if (passphrase && passphrase !== true) return Identity.fromPassphrase(passphrase);

  return null;
}
