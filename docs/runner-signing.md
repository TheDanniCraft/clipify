# Runner execution signing

Free broadcasts use renewable server-signed execution leases. The server holds an
Ed25519 private key; Runner distributions hold only explicitly configured public
verification keys. A key supplied by a heartbeat response never grants trust.

Free broadcasts need an ongoing connection to Clipify. After about five minutes
without renewal, the native Runner finishes the current clip and closes its
outputs. No monthly streaming-hour quota applies. The dashboard explains this
connectivity requirement before starting a Free broadcast.

## Configure a deployment

Set `RUNNER_EXECUTION_SIGNING_PRIVATE_KEY` in the application's server secret
store. Set the GitHub repository variable `RUNNER_EXECUTION_PUBLIC_KEYS` to a
compact JSON object mapping key IDs to public PEM strings. A key ID is the first
16 hexadecimal characters of the SHA-256 digest of the public SPKI DER bytes.
Both values must come from the same key pair.

The native build validates and embeds the public mapping. Native artifact
fingerprints include that mapping, so rotating trust keys cannot reuse an older
executable. Release image builds pass the same public mapping into Docker's
`RUNNER_EXECUTION_PUBLIC_KEYS` build argument when generating the application
Runner artifact context. An independently built application image must use the
same build argument as its native Runner artifacts.

Generate a development pair without printing the private key:

```sh
node --input-type=module <<'NODE'
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'clipify-runner-signing-'));
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const keyId = createHash('sha256')
  .update(publicKey.export({ type: 'spki', format: 'der' }))
  .digest('hex').slice(0, 16);
writeFileSync(join(directory, 'private.pem'),
  privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
writeFileSync(join(directory, 'public-keys.json'), JSON.stringify({
  [keyId]: publicKey.export({ type: 'spki', format: 'pem' }).toString()
}), { mode: 0o600 });
console.log(`Private key file: ${join(directory, 'private.pem')}`);
console.log(`Public mapping file: ${join(directory, 'public-keys.json')}`);
NODE
```

Import the private file into the server secret store and use the public JSON for
the repository variable. Keep the private file outside the checkout. For a source
Runner in development, provide the same public JSON through its
`RUNNER_EXECUTION_PUBLIC_KEYS` environment variable. Local tests generate their
own ephemeral keys and do not require deployment credentials.

## Rotation and compatibility

The public configuration supports up to eight Ed25519 verification keys. Publish
Runner builds that trust both the old and new keys before switching the server's
signing key. Keep the old verification key throughout the lifetime of previously
issued snapshots, including the seven-day Pro scheduling horizon and bounded
drain margin. Builds without a newly required verification key need updating.
Invalid key configuration is rejected before packaging; a Runner without trusted
keys cannot open a Free broadcast.

## Revoked devices

Unlinking or deleting a device revokes start and renewal authority immediately.
The former credential is retained locally only for the terminal-receipt endpoint,
using the OS keyring or an owner-restricted fallback file. It is separate from
current enrollment and from the execution journal. A successful HTTP response
alone does not retire a receipt; the endpoint must explicitly accept closure of
the exact broadcast generation.
