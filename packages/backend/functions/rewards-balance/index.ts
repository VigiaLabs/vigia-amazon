import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import bs58 from 'bs58';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.REWARDS_LEDGER_TABLE_NAME!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  const wallet = event.queryStringParameters?.wallet_address;
  if (!wallet) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'wallet_address required' }) };

  try {
    // Validate it's a valid base58 Solana pubkey (32 bytes decoded)
    const decoded = bs58.decode(wallet);
    if (decoded.length !== 32) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid Solana public key' }) };
    }

    const res = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { wallet_address: wallet } }));
    const item = res.Item ?? {};
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet_address: wallet,
        pending_balance: item.pending_balance?.toString() ?? '0',
        total_earned:    item.total_earned?.toString()    ?? '0',
        total_claimed:   item.total_claimed?.toString()   ?? '0',
        nonce:           item.nonce ?? 0,
        last_hazard_id:  item.last_hazard_id ?? null,
      }),
    };
  } catch (e: any) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
