import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GeoPlacesClient, ReverseGeocodeCommand } from '@aws-sdk/client-geo-places';
import ngeohash from 'ngeohash';

const client = new GeoPlacesClient({ region: 'us-east-1' });

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

/**
 * Resolve a geohash to a human-readable location.
 *
 * Wired as an API Gateway proxy integration, so the geohash arrives in the
 * request body (`{ "geohash7": "..." }`) — NOT as a top-level event field.
 * Reading `event.geohash7` directly (the previous implementation) yielded
 * `undefined`, which made the decoder throw "geohash is not iterable" and
 * surfaced as a 502.
 */
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const geohash: unknown = body.geohash7 ?? body.geohash;

    if (typeof geohash !== 'string' || geohash.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          error: 'Missing geohash. Provide { "geohash7": "..." } in the request body.',
        }),
      };
    }

    // Decode with the proper library rather than a hand-rolled base32 loop.
    const { latitude, longitude } = ngeohash.decode(geohash);

    // Real reverse geocoding via Amazon Location Service (same client the
    // places search Lambda uses). If it fails or is unauthorized, we still
    // return the decoded coordinates so the caller gets a usable response.
    let region: string | undefined;
    let city: string | undefined;
    let country = 'India';
    try {
      const geo = await client.send(
        new ReverseGeocodeCommand({
          QueryPosition: [longitude, latitude],
          MaxResults: 1,
        })
      );
      const address = geo.ResultItems?.[0]?.Address;
      if (address) {
        region = address.Region?.Name ?? undefined;
        city = address.Locality ?? address.District ?? undefined;
        country = address.Country?.Name ?? country;
      }
    } catch (geoErr) {
      console.warn('ReverseGeocode failed, returning coordinates only:', geoErr);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        geohash,
        lat: latitude,
        lon: longitude,
        continent: 'Asia',
        country,
        region,
        city,
      }),
    };
  } catch (error: any) {
    console.error('Geohash resolve error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};
