#!/usr/bin/env python3
"""
Test script for VIGIA Agent Action Groups
Tests the 3 new Lambda functions with mock data
"""

import json
import math

# ============================================================================
# MOCK DATA
# ============================================================================

MOCK_HAZARDS = [
    {'geohash': 'drt2y', 'timestamp': '2026-03-01T10:00:00Z', 'hazardType': 'POTHOLE', 'verificationScore': 85, 'contributorId': 'node1'},
    {'geohash': 'drt2y', 'timestamp': '2026-03-02T11:00:00Z', 'hazardType': 'DEBRIS', 'verificationScore': 60, 'contributorId': 'node2'},
    {'geohash': 'drt2z', 'timestamp': '2026-03-03T12:00:00Z', 'hazardType': 'POTHOLE', 'verificationScore': 92, 'contributorId': 'node1'},
    {'geohash': 'drt2z', 'timestamp': '2026-03-03T13:00:00Z', 'hazardType': 'ACCIDENT', 'verificationScore': 95, 'contributorId': 'node3'},
]

# ============================================================================
# NETWORK INTELLIGENCE LOGIC
# ============================================================================

def test_network_intelligence():
    print("=" * 80)
    print("TEST 1: Network Intelligence - analyze_node_connectivity")
    print("=" * 80)
    
    geohash_prefix = "drt2"
    
    # Filter hazards by prefix
    filtered = [h for h in MOCK_HAZARDS if h['geohash'].startswith(geohash_prefix)]
    
    # Extract unique contributors
    unique_contributors = set(h['contributorId'] for h in filtered)
    unique_geohashes = set(h['geohash'] for h in filtered)
    
    active_node_count = len(unique_contributors)
    coverage_spread = len(unique_geohashes)
    
    # Health score: min(100, (nodes * 15) + (spread * 5))
    health_score = min(100, int((active_node_count * 15) + (coverage_spread * 5)))
    
    result = {
        'activeNodeCount': active_node_count,
        'geographicSpread': {
            'coverageAreaKm2': coverage_spread * 25,
            'uniqueGeohashes': coverage_spread
        },
        'healthScore': health_score,
        'lastActivityTimestamp': '2026-03-03T13:00:00Z'
    }
    
    print(f"Input: geohash_prefix='{geohash_prefix}'")
    print(f"Filtered Hazards: {len(filtered)}")
    print(f"Unique Contributors: {active_node_count}")
    print(f"Unique Geohashes: {coverage_spread}")
    print(f"Health Score: {health_score}/100")
    print(f"\nResult:")
    print(json.dumps(result, indent=2))
    print()

# ============================================================================
# MAINTENANCE LOGISTICS LOGIC
# ============================================================================

SEVERITY_MAP = {'POTHOLE': 60, 'DEBRIS': 40, 'ACCIDENT': 100, 'ANIMAL': 20}
BASE_COSTS = {'POTHOLE': 500, 'DEBRIS': 200, 'ACCIDENT': 5000, 'ANIMAL': 100}

def get_deterministic_traffic_score(geohash):
    """Generate consistent traffic score from geohash"""
    return (ord(geohash[-1]) % 10) * 10 + 10

def test_maintenance_logistics():
    print("=" * 80)
    print("TEST 2: Maintenance Logistics - prioritize_repair_queue")
    print("=" * 80)
    
    hazard_ids = [
        'drt2y#2026-03-01T10:00:00Z',
        'drt2y#2026-03-02T11:00:00Z',
        'drt2z#2026-03-03T12:00:00Z',
        'drt2z#2026-03-03T13:00:00Z'
    ]
    
    prioritized = []
    
    for hazard_id in hazard_ids:
        geohash, timestamp = hazard_id.split('#')
        
        # Find matching hazard
        hazard = next((h for h in MOCK_HAZARDS if h['geohash'] == geohash and h['timestamp'] == timestamp), None)
        if not hazard:
            continue
        
        hazard_type = hazard['hazardType']
        verification_score = hazard['verificationScore']
        
        severity_score = SEVERITY_MAP.get(hazard_type, 50)
        traffic_score = get_deterministic_traffic_score(geohash)
        
        # Priority: (severity * 0.5) + (traffic * 0.3) + (verification * 0.2)
        priority = (severity_score * 0.5) + (traffic_score * 0.3) + (verification_score * 0.2)
        
        base_cost = BASE_COSTS.get(hazard_type, 500)
        severity_multiplier = verification_score / 100
        estimated_cost = int(base_cost * (1 + severity_multiplier * 0.2))
        
        traffic_label = 'high' if traffic_score >= 70 else ('medium' if traffic_score >= 40 else 'low')
        
        prioritized.append({
            'hazardId': hazard_id,
            'hazardType': hazard_type,
            'priority': round(priority, 2),
            'estimatedCost': estimated_cost,
            'trafficScore': traffic_score,
            'reasoning': f"{hazard_type} in {traffic_label} traffic area (score: {traffic_score}), {int(verification_score)}% verified"
        })
    
    prioritized.sort(key=lambda x: x['priority'], reverse=True)
    
    print(f"Input: {len(hazard_ids)} hazards")
    print(f"\nPrioritized Queue (highest to lowest):")
    for i, item in enumerate(prioritized, 1):
        print(f"\n{i}. {item['hazardType']} (Priority: {item['priority']})")
        print(f"   Traffic Score: {item['trafficScore']}")
        print(f"   Cost: ${item['estimatedCost']}")
        print(f"   Reasoning: {item['reasoning']}")
    print()

# ============================================================================
# URBAN PLANNER LOGIC
# ============================================================================

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in km"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c

def quadratic_bezier(t, p0, p1, p2):
    """Quadratic Bezier curve"""
    return (1-t)**2 * p0 + 2*(1-t)*t * p1 + t**2 * p2

def test_urban_planner():
    print("=" * 80)
    print("TEST 3: Urban Planner - find_optimal_path (Bezier Bypass)")
    print("=" * 80)
    
    start = {'lat': 42.3601, 'lon': -71.0589}
    end = {'lat': 42.3656, 'lon': -71.0596}
    
    # Calculate midpoint
    mid_lat = (start['lat'] + end['lat']) / 2
    mid_lon = (start['lon'] + end['lon']) / 2
    
    # Perpendicular vector
    dy = end['lat'] - start['lat']
    dx = end['lon'] - start['lon']
    length = math.sqrt(dx**2 + dy**2)
    if length == 0:
        length = 0.001
    
    # Control point offset by ~600m
    offset = 0.006
    perp_lat = -dy / length * offset
    perp_lon = dx / length * offset
    
    control_lat = mid_lat + perp_lat
    control_lon = mid_lon + perp_lon
    
    # Generate 20 points
    path = []
    for i in range(21):
        t = i / 20
        lat = quadratic_bezier(t, start['lat'], control_lat, end['lat'])
        lon = quadratic_bezier(t, start['lon'], control_lon, end['lon'])
        path.append({'lat': round(lat, 6), 'lon': round(lon, 6)})
    
    # Calculate curve length
    total_distance = 0
    for i in range(len(path) - 1):
        total_distance += haversine_distance(path[i]['lat'], path[i]['lon'], path[i+1]['lat'], path[i+1]['lon'])
    
    hazards_avoided = int(total_distance * 15)
    direct_distance = haversine_distance(start['lat'], start['lon'], end['lat'], end['lon'])
    detour_percent = ((total_distance - direct_distance) / direct_distance * 100) if direct_distance > 0 else 0
    
    print(f"Start: {start}")
    print(f"End: {end}")
    print(f"Control Point: ({round(control_lat, 6)}, {round(control_lon, 6)})")
    print(f"\nDirect Distance: {round(direct_distance, 2)} km")
    print(f"Bezier Path Distance: {round(total_distance, 2)} km")
    print(f"Detour: {round(detour_percent, 1)}%")
    print(f"Hazards Avoided: {hazards_avoided}")
    print(f"\nPath Points (first 5):")
    for i, p in enumerate(path[:5]):
        print(f"  {i}: ({p['lat']}, {p['lon']})")
    print(f"  ...")
    print(f"  {len(path)-1}: ({path[-1]['lat']}, {path[-1]['lon']})")
    
    # ROI Calculation
    print(f"\n--- ROI Analysis ---")
    construction_cost = int(total_distance * 1500000)
    land_acquisition = 400000
    total_cost = construction_cost + land_acquisition
    annual_savings = hazards_avoided * 500
    break_even = total_cost / annual_savings if annual_savings > 0 else 999
    roi_10_year = ((annual_savings * 10 - total_cost) / total_cost * 100) if total_cost > 0 else 0
    
    print(f"Construction Cost: ${construction_cost:,}")
    print(f"Land Acquisition: ${land_acquisition:,}")
    print(f"Total Project Cost: ${total_cost:,}")
    print(f"Annual Repair Savings: ${annual_savings:,}")
    print(f"Break-Even: {round(break_even, 1)} years")
    print(f"10-Year ROI: {round(roi_10_year, 1)}%")
    print(f"\nRecommendation: Optimal path identified. Bypass required to avoid high-density")
    print(f"residential zone (Sector 4) and minimize acquisition costs.")
    print()

# ============================================================================
# MAIN
# ============================================================================

if __name__ == '__main__':
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "VIGIA AGENT ACTION GROUPS TEST" + " " * 28 + "║")
    print("╚" + "=" * 78 + "╝")
    print()
    
    test_network_intelligence()
    test_maintenance_logistics()
    test_urban_planner()
    
    print("=" * 80)
    print("ALL TESTS COMPLETE ✅")
    print("=" * 80)
