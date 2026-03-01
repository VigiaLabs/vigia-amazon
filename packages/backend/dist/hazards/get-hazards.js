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
            TableName: process.env.HAZARDS_TABLE_NAME,
            Limit: 100,
        }));
        const items = response.Items || [];
        // Sort by timestamp descending (most recent first)
        const sorted = items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                hazards: sorted,
                count: sorted.length,
            }),
        };
    }
    catch (error) {
        console.error('Error fetching hazards:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ error: 'Failed to fetch hazards' }),
        };
    }
};
exports.handler = handler;
