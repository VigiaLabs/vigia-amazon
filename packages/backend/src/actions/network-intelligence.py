import json
import os
import boto3
from decimal import Decimal
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
hazards_table = dynamodb.Table(os.environ['HAZARDS_TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def analyze_node_connectivity(event):
    """Analyze DePIN network health in a geographic area"""
    print(f"[NetworkIntel] analyze_node_connectivity: {json.dumps(event)}")
    
    geohash = event.get('geohash', '')
    radius_km = event.get('radiusKm', 10)
    
    # Handle Bedrock Agent parameter format (parameters array)
    if 'parameters' in event and event['parameters']:
        for param in event['parameters']:
            if param.get('name') == 'geohash':
                geohash = param.get('value')
            elif param.get('name') == 'radiusKm':
                radius_km = float(param.get('value', 10))
    
    # Handle Bedrock Agent requestBody format
    if 'requestBody' in event and 'content' in event['requestBody']:
        content = event['requestBody']['content']
        if 'application/json' in content:
            props = content['application/json'].get('properties', [])
            for prop in props:
                if prop.get('name') == 'geohash':
                    geohash = prop.get('value')
                elif prop.get('name') == 'radiusKm':
                    radius_km = float(prop.get('value', 10))
    
    if not geohash:
        return {'statusCode': 400, 'body': {'error': 'geohash required'}}
    
    geohash_prefix = geohash[:5]
    
    try:
        # NOTE: Using Scan with FilterExpression for hackathon scale (<1k items)
        # Production should use GSI with geohash prefix as partition key
        cutoff_time = (datetime.utcnow() - timedelta(days=7)).isoformat()
        
        response = hazards_table.scan(
            FilterExpression='begins_with(geohash, :prefix) AND #ts > :cutoff',
            ExpressionAttributeNames={'#ts': 'timestamp'},
            ExpressionAttributeValues={
                ':prefix': geohash_prefix,
                ':cutoff': cutoff_time
            }
        )
        
        hazards = response.get('Items', [])
        
        unique_contributors = set()
        unique_geohashes = set()
        
        for hazard in hazards:
            contributor_id = hazard.get('contributorId') or hazard.get('signature', '')
            if contributor_id:
                unique_contributors.add(contributor_id)
            unique_geohashes.add(hazard.get('geohash', ''))
        
        active_node_count = len(unique_contributors)
        coverage_spread = len(unique_geohashes)
        
        # Health score: min(100, (nodes * 15) + (spread * 5))
        health_score = min(100, int((active_node_count * 15) + (coverage_spread * 5)))
        
        last_activity = None
        if hazards:
            timestamps = [h.get('timestamp', '') for h in hazards if h.get('timestamp')]
            if timestamps:
                last_activity = max(timestamps)
        
        return {
            'statusCode': 200,
            'body': {
                'activeNodeCount': active_node_count,
                'geographicSpread': {
                    'coverageAreaKm2': coverage_spread * 25,
                    'uniqueGeohashes': coverage_spread
                },
                'healthScore': health_score,
                'lastActivityTimestamp': last_activity or datetime.utcnow().isoformat()
            }
        }
    except Exception as e:
        print(f"[NetworkIntel] Error: {str(e)}")
        return {'statusCode': 500, 'body': {'error': str(e)}}

def identify_coverage_gaps(event):
    """Identify areas with low sensor coverage"""
    print(f"[NetworkIntel] identify_coverage_gaps: {json.dumps(event)}")
    
    bbox = event.get('boundingBox', {})
    min_threshold = event.get('minReportsThreshold', 5)
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'boundingBox':
                bbox = json.loads(param.get('value', '{}'))
            elif param.get('name') == 'minReportsThreshold':
                min_threshold = int(param.get('value', 5))
    
    if not bbox or not all(k in bbox for k in ['north', 'south', 'east', 'west']):
        return {'statusCode': 400, 'body': {'error': 'boundingBox required'}}
    
    try:
        gaps = []
        lat_step = (bbox['north'] - bbox['south']) / 3
        lon_step = (bbox['east'] - bbox['west']) / 3
        
        for i in range(3):
            for j in range(3):
                lat = bbox['south'] + (i + 0.5) * lat_step
                lon = bbox['west'] + (j + 0.5) * lon_step
                geohash = f"gh{i}{j}xyz"
                
                response = hazards_table.query(
                    KeyConditionExpression='geohash = :gh',
                    ExpressionAttributeValues={':gh': geohash},
                    Limit=min_threshold + 1
                )
                
                report_count = len(response.get('Items', []))
                
                if report_count < min_threshold:
                    severity = 'HIGH' if report_count == 0 else ('MEDIUM' if report_count < 3 else 'LOW')
                    gaps.append({
                        'geohash': geohash,
                        'centerLat': lat,
                        'centerLon': lon,
                        'reportCount': report_count,
                        'severity': severity
                    })
        
        return {
            'statusCode': 200,
            'body': {
                'gapPolygons': gaps,
                'totalGaps': len(gaps)
            }
        }
    except Exception as e:
        print(f"[NetworkIntel] Error: {str(e)}")
        return {'statusCode': 500, 'body': {'error': str(e)}}

def lambda_handler(event, context):
    """Route to appropriate tool"""
    api_path = event.get('apiPath', '')
    
    if api_path == '/analyze-node-connectivity':
        result = analyze_node_connectivity(event)
    elif api_path == '/identify-coverage-gaps':
        result = identify_coverage_gaps(event)
    else:
        result = {'statusCode': 404, 'body': {'error': 'Unknown API path'}}
    
    return {
        'messageVersion': '1.0',
        'response': {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': api_path,
            'httpMethod': event.get('httpMethod', 'POST'),
            'httpStatusCode': result['statusCode'],
            'responseBody': {
                'application/json': {
                    'body': json.dumps(result['body'], cls=DecimalEncoder)
                }
            }
        }
    }
