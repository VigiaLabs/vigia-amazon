import json
import os
import boto3
from decimal import Decimal
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
hazards_table = dynamodb.Table(os.environ['HAZARDS_TABLE_NAME'])

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

SEVERITY_MAP = {
    'POTHOLE': 60,
    'DEBRIS': 40,
    'ACCIDENT': 100,
    'ANIMAL': 20
}

BASE_COSTS = {
    'POTHOLE': 500,
    'DEBRIS': 200,
    'ACCIDENT': 5000,
    'ANIMAL': 100
}

def get_deterministic_traffic_score(geohash):
    """Generate consistent traffic score from geohash"""
    # Use last character to seed traffic (10-100)
    return (ord(geohash[-1]) % 10) * 10 + 10

def prioritize_repair_queue(event):
    """Prioritize hazards by urgency"""
    print(f"[MaintenanceLogistics] prioritize_repair_queue: {json.dumps(event)}")
    
    hazard_ids = event.get('hazardIds', [])
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'hazardIds':
                hazard_ids = json.loads(param.get('value', '[]'))
    
    if not hazard_ids:
        return {'statusCode': 400, 'body': {'error': 'hazardIds required'}}
    
    try:
        prioritized = []
        
        for hazard_id in hazard_ids:
            parts = hazard_id.split('#')
            if len(parts) != 2:
                continue
            
            geohash, timestamp = parts
            
            response = hazards_table.get_item(
                Key={'geohash': geohash, 'timestamp': timestamp}
            )
            
            hazard = response.get('Item')
            if not hazard:
                continue
            
            hazard_type = hazard.get('hazardType', 'POTHOLE')
            verification_score = float(hazard.get('verificationScore', 50))
            
            # Severity score
            severity_score = SEVERITY_MAP.get(hazard_type, 50)
            
            # Deterministic traffic score from geohash
            traffic_score = get_deterministic_traffic_score(geohash)
            
            # Priority: (severity * 0.5) + (traffic * 0.3) + (verification * 0.2)
            priority = (severity_score * 0.5) + (traffic_score * 0.3) + (verification_score * 0.2)
            
            # Estimate cost
            base_cost = BASE_COSTS.get(hazard_type, 500)
            severity_multiplier = verification_score / 100
            estimated_cost = int(base_cost * (1 + severity_multiplier * 0.2))
            
            traffic_label = 'high' if traffic_score >= 70 else ('medium' if traffic_score >= 40 else 'low')
            
            prioritized.append({
                'hazardId': hazard_id,
                'hazardType': hazard_type,
                'priority': round(priority, 2),
                'estimatedCost': estimated_cost,
                'reasoning': f"{hazard_type} in {traffic_label} traffic area (score: {traffic_score}), {int(verification_score)}% verified"
            })
        
        prioritized.sort(key=lambda x: x['priority'], reverse=True)
        
        return {
            'statusCode': 200,
            'body': {'prioritizedQueue': prioritized}
        }
    except Exception as e:
        print(f"[MaintenanceLogistics] Error: {str(e)}")
        return {'statusCode': 500, 'body': {'error': str(e)}}

def estimate_repair_cost(event):
    """Estimate total repair cost"""
    print(f"[MaintenanceLogistics] estimate_repair_cost: {json.dumps(event)}")
    
    hazard_ids = event.get('hazardIds', [])
    
    if 'parameters' in event:
        for param in event['parameters']:
            if param.get('name') == 'hazardIds':
                hazard_ids = json.loads(param.get('value', '[]'))
    
    if not hazard_ids:
        return {'statusCode': 400, 'body': {'error': 'hazardIds required'}}
    
    try:
        total_cost = 0
        breakdown = []
        
        for hazard_id in hazard_ids:
            parts = hazard_id.split('#')
            if len(parts) != 2:
                continue
            
            geohash, timestamp = parts
            
            response = hazards_table.get_item(
                Key={'geohash': geohash, 'timestamp': timestamp}
            )
            
            hazard = response.get('Item')
            if not hazard:
                continue
            
            hazard_type = hazard.get('hazardType', 'POTHOLE')
            verification_score = float(hazard.get('verificationScore', 50))
            
            base_cost = BASE_COSTS.get(hazard_type, 500)
            severity_multiplier = verification_score / 100
            final_cost = base_cost * (1 + severity_multiplier * 0.2)
            
            total_cost += final_cost
            
            breakdown.append({
                'hazardId': hazard_id,
                'hazardType': hazard_type,
                'baseCost': base_cost,
                'severityMultiplier': round(severity_multiplier, 2),
                'finalCost': round(final_cost, 2)
            })
        
        return {
            'statusCode': 200,
            'body': {
                'totalCost': round(total_cost, 2),
                'breakdown': breakdown
            }
        }
    except Exception as e:
        print(f"[MaintenanceLogistics] Error: {str(e)}")
        return {'statusCode': 500, 'body': {'error': str(e)}}

def lambda_handler(event, context):
    """Route to appropriate tool"""
    api_path = event.get('apiPath', '')
    
    if api_path == '/prioritize-repair-queue':
        result = prioritize_repair_queue(event)
    elif api_path == '/estimate-repair-cost':
        result = estimate_repair_cost(event)
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
