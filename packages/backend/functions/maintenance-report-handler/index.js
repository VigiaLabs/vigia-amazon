"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const crypto_1 = require("crypto");
const dynamoClient = new client_dynamodb_1.DynamoDBClient({});
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(dynamoClient);
function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    };
}
const BASE_COSTS = {
    POTHOLE: 150,
    DEBRIS: 50,
    FLOODING: 1000,
    ACCIDENT: 0,
};
const PREVENTED_DAMAGE = {
    POTHOLE: 300,
    DEBRIS: 150,
    FLOODING: 2000,
    ACCIDENT: 5000,
};
function calculateRepairCost(type, severity) {
    const baseCost = BASE_COSTS[type] || 0;
    return Math.round(baseCost * (1 + severity * 0.2));
}
const ALLOWED_STATUSES = new Set(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED']);
const handler = async (event) => {
    try {
        const body = JSON.parse(event.body || '{}');
        const { hazardId, geohash, type, severity, reportedBy, notes, signature, reportId: reportIdInput, status } = body;
        // Status update mode (reuses the same endpoint to avoid extra API Gateway/Lambda wiring).
        if (reportIdInput && status && !hazardId && !geohash) {
            if (!ALLOWED_STATUSES.has(status)) {
                return {
                    statusCode: 400,
                    headers: corsHeaders(),
                    body: JSON.stringify({ error: 'Invalid status' }),
                };
            }
            const existing = await docClient.send(new lib_dynamodb_1.QueryCommand({
                TableName: process.env.MAINTENANCE_QUEUE_TABLE,
                KeyConditionExpression: 'reportId = :rid',
                ExpressionAttributeValues: {
                    ':rid': reportIdInput,
                },
                Limit: 1,
            }));
            const item = ((existing.Items || [])[0]);
            if (!(item === null || item === void 0 ? void 0 : item.reportId) || typeof (item === null || item === void 0 ? void 0 : item.reportedAt) !== 'number') {
                return {
                    statusCode: 404,
                    headers: corsHeaders(),
                    body: JSON.stringify({ error: 'Report not found' }),
                };
            }
            await docClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: process.env.MAINTENANCE_QUEUE_TABLE,
                Key: { reportId: item.reportId, reportedAt: item.reportedAt },
                UpdateExpression: 'SET #status = :status, updatedAt = :now' + (status === 'COMPLETED' ? ', completedAt = :now' : ''),
                ExpressionAttributeNames: {
                    '#status': 'status',
                },
                ExpressionAttributeValues: {
                    ':status': status,
                    ':now': Date.now(),
                },
            }));
            return {
                statusCode: 200,
                headers: corsHeaders(),
                body: JSON.stringify({ reportId: item.reportId, reportedAt: item.reportedAt, status }),
            };
        }
        if (!hazardId || !geohash || !type || !severity || !reportedBy || !signature) {
            return {
                statusCode: 400,
                headers: corsHeaders(),
                body: JSON.stringify({ error: 'Missing required fields' }),
            };
        }
        // TODO: Verify ECDSA signature
        // const isValid = await verifyECDSA(signature, hazardId);
        // if (!isValid) {
        //   return { statusCode: 403, body: JSON.stringify({ error: 'Invalid signature' }) };
        // }
        const reportId = (0, crypto_1.randomUUID)();
        const reportedAt = Date.now();
        const estimatedCost = calculateRepairCost(type, severity);
        // Save to MaintenanceQueue
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: process.env.MAINTENANCE_QUEUE_TABLE,
            Item: {
                reportId,
                hazardId,
                geohash,
                type,
                severity,
                reportedBy,
                reportedAt,
                estimatedCost,
                status: 'PENDING',
                notes: notes || undefined,
                signature,
            },
        }));
        // Update EconomicMetrics (simplified - should use DynamoDB Streams in production)
        const sessionId = 'current-session'; // TODO: Get from context
        const preventedDamage = PREVENTED_DAMAGE[type] || 0;
        try {
            await docClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: process.env.ECONOMIC_METRICS_TABLE,
                Key: { sessionId, timestamp: Date.now() },
                UpdateExpression: 'ADD totalHazardsDetected :one, totalEstimatedRepairCost :cost, totalPreventedDamageCost :prevented',
                ExpressionAttributeValues: {
                    ':one': 1,
                    ':cost': estimatedCost,
                    ':prevented': preventedDamage,
                },
            }));
        }
        catch (error) {
            console.warn('[MaintenanceReportHandler] Failed to update metrics:', error);
        }
        return {
            statusCode: 201,
            headers: corsHeaders(),
            body: JSON.stringify({ reportId, estimatedCost }),
        };
    }
    catch (error) {
        console.error('[MaintenanceReportHandler] Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders(),
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};
exports.handler = handler;
