"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const dynamodb = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
const handler = async () => {
    try {
        const response = await dynamodb.send(new lib_dynamodb_1.ScanCommand({
            TableName: process.env.TRACES_TABLE_NAME,
            Limit: 1,
        }));
        const items = response.Items || [];
        // Sort by createdAt descending (most recent first)
        const sorted = items.sort((a, b) => new Date(b.createdAt || b.timestamp || 0).getTime() -
            new Date(a.createdAt || a.timestamp || 0).getTime());
        const latestTrace = sorted[0] || null;
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                trace: latestTrace,
                hasData: !!latestTrace,
            }),
        };
    }
    catch (error) {
        console.error('Error fetching traces:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to fetch traces' }),
        };
    }
};
exports.handler = handler;
