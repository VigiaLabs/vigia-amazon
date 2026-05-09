import { Keypair, Connection } from '@solana/web3.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

let _authority: Keypair | null = null;
let _connection: Connection | null = null;

const sm = new SecretsManagerClient({ region: 'us-east-1' });

export async function getAuthority(): Promise<Keypair> {
  if (_authority) return _authority;
  const { SecretString } = await sm.send(new GetSecretValueCommand({
    SecretId: process.env.SOLANA_AUTHORITY_SECRET_ARN!,
  }));
  const { privateKey } = JSON.parse(SecretString!);
  _authority = Keypair.fromSecretKey(Uint8Array.from(privateKey));
  return _authority;
}

export function getConnection(): Connection {
  if (!_connection) _connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');
  return _connection;
}
