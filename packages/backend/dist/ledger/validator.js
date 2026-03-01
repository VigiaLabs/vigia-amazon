"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const client = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(client);
const LEDGER_ENTRIES_TABLE = process.env.LEDGER_ENTRIES_TABLE;
async function handler(event) {
    const sessionId = event.pathParameters?.sessionId;
    if (!sessionId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'sessionId is required' }),
        };
    }
    try {
        // Query ledger entries for session
        const result = await docClient.send(new lib_dynamodb_1.QueryCommand({
            TableName: LEDGER_ENTRIES_TABLE,
            KeyConditionExpression: 'ledgerId = :ledgerId',
            FilterExpression: 'sessionId = :sessionId',
            ExpressionAttributeValues: {
                ':ledgerId': 'ledger',
                ':sessionId': sessionId,
            },
            ScanIndexForward: true, // Oldest first
        }));
        const entries = result.Items || [];
        // Validate hash chain
        for (let i = 0; i < entries.length; i++) {
            const current = entries[i];
            // Recompute hash
            const payload = `${current.timestamp}${current.sessionId}${current.action}${current.previousHash}${current.contributorId}`;
            const expectedHash = (0, crypto_1.createHash)('sha256').update(payload).digest('hex');
            if (current.currentHash !== expectedHash) {
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({ valid: false, brokenAt: i, reason: 'Hash mismatch' }),
                };
            }
            // Check chain link
            if (i > 0) {
                const previous = entries[i - 1];
                if (current.previousHash !== previous.currentHash) {
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ valid: false, brokenAt: i, reason: 'Chain broken' }),
                    };
                }
            }
            else {
                // First entry should have genesis
                if (current.previousHash !== 'genesis') {
                    return {
                        statusCode: 200,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                        body: JSON.stringify({ valid: false, brokenAt: 0, reason: 'Missing genesis' }),
                    };
                }
            }
        }
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ valid: true, entries: entries.length }),
        };
    }
    catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Internal server error', message: error.message }),
        };
    }
}
