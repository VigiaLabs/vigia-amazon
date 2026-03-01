"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_geo_places_1 = require("@aws-sdk/client-geo-places");
const client = new client_geo_places_1.GeoPlacesClient({ region: 'us-east-1' });
const handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    try {
        const body = JSON.parse(event.body || '{}');
        const { query, position } = body;
        if (query) {
            // Text search with worldwide bounding box
            const command = new client_geo_places_1.SearchTextCommand({
                QueryText: query,
                MaxResults: 10,
                Filter: {
                    BoundingBox: [-180, -90, 180, 90], // Worldwide
                },
            });
            const response = await client.send(command);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response),
            };
        }
        else if (position) {
            // Reverse geocode
            const command = new client_geo_places_1.ReverseGeocodeCommand({
                QueryPosition: position,
                MaxResults: 1,
            });
            const response = await client.send(command);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response),
            };
        }
        else {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing query or position' }),
            };
        }
    }
    catch (error) {
        console.error('Places search error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Internal server error' }),
        };
    }
};
exports.handler = handler;
