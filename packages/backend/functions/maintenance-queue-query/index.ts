import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  };
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const status = event.queryStringParameters?.status;
    const geohash = event.queryStringParameters?.geohash;

    let result;

    if (status) {
      // Query by status using GSI
      result = await docClient.send(new QueryCommand({
        TableName: process.env.MAINTENANCE_QUEUE_TABLE!,
        IndexName: 'StatusIndex',
        KeyConditionExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
        },
        ScanIndexForward: false,
        Limit: 100,
      }));
    } else if (geohash) {
      // Query by geohash using GSI
      result = await docClient.send(new QueryCommand({
        TableName: process.env.MAINTENANCE_QUEUE_TABLE!,
        IndexName: 'GeohashIndex',
        KeyConditionExpression: 'geohash = :geohash',
        ExpressionAttributeValues: {
          ':geohash': geohash,
        },
        ScanIndexForward: false,
        Limit: 100,
      }));
    } else {
      // Scan all (limited to 100 items)
      result = await docClient.send(new ScanCommand({
        TableName: process.env.MAINTENANCE_QUEUE_TABLE!,
        Limit: 100,
      }));
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify((result.Items || []).sort((a: any, b: any) => (Number(b?.reportedAt) || 0) - (Number(a?.reportedAt) || 0))),
    };
  } catch (error) {
    console.error('[MaintenanceQueueQuery] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
