#!/bin/bash

# VIGIA Bedrock Agent Configuration Script
# This script adds 3 new action groups to the existing agent

set -e

AGENT_ID="TAWWC3SQ0L"
REGION="us-east-1"

# Lambda ARNs from CDK outputs
NETWORK_INTELLIGENCE_ARN="arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsNetworkIntellige-BQpjldvWdtKt"
MAINTENANCE_LOGISTICS_ARN="arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsMaintenanceLogis-DFZlsGUW5tBE"
URBAN_PLANNER_ARN="arn:aws:lambda:us-east-1:203800220566:function:VigiaStack-IntelligenceWithHazardsUrbanPlannerFunc-spESG0Jxisgr"

echo "🚀 Configuring VIGIA Bedrock Agent..."
echo "Agent ID: $AGENT_ID"
echo ""

# Add Network Intelligence Action Group
echo "🌐 Adding Network Intelligence action group..."
aws bedrock-agent create-agent-action-group \
  --agent-id "$AGENT_ID" \
  --agent-version "DRAFT" \
  --action-group-name "NetworkIntelligence" \
  --description "Analyze DePIN network health and identify coverage gaps" \
  --action-group-executor lambda="$NETWORK_INTELLIGENCE_ARN" \
  --api-schema 'payload={"openapi":"3.0.0","info":{"title":"Network Intelligence API","version":"1.0.0"},"paths":{"/analyze-node-connectivity":{"post":{"description":"Analyze network health","parameters":[{"name":"geohash","in":"query","required":true,"schema":{"type":"string"}},{"name":"radiusKm","in":"query","schema":{"type":"number"}}],"responses":{"200":{"description":"OK"}}}},"/identify-coverage-gaps":{"post":{"description":"Identify coverage gaps","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"boundingBox":{"type":"object"},"minReportsThreshold":{"type":"number"}}}}}},"responses":{"200":{"description":"OK"}}}}}}' \
  --region "$REGION" || echo "⚠️  Action group may already exist"

echo ""

# Add Maintenance Logistics Action Group
echo "🔧 Adding Maintenance Logistics action group..."
aws bedrock-agent create-agent-action-group \
  --agent-id "$AGENT_ID" \
  --agent-version "DRAFT" \
  --action-group-name "MaintenanceLogistics" \
  --description "Prioritize repairs and estimate costs" \
  --action-group-executor lambda="$MAINTENANCE_LOGISTICS_ARN" \
  --api-schema 'payload={"openapi":"3.0.0","info":{"title":"Maintenance Logistics API","version":"1.0.0"},"paths":{"/prioritize-repair-queue":{"post":{"description":"Prioritize repairs","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"hazardIds":{"type":"array"},"trafficDensitySource":{"type":"string"}}}}}},"responses":{"200":{"description":"OK"}}}},"/estimate-repair-cost":{"post":{"description":"Estimate costs","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"hazardIds":{"type":"array"}}}}}},"responses":{"200":{"description":"OK"}}}}}}' \
  --region "$REGION" || echo "⚠️  Action group may already exist"

echo ""

# Add Urban Planner Action Group
echo "🏗️  Adding Urban Planner action group..."
aws bedrock-agent create-agent-action-group \
  --agent-id "$AGENT_ID" \
  --agent-version "DRAFT" \
  --action-group-name "UrbanPlanner" \
  --description "Find optimal paths and calculate ROI" \
  --action-group-executor lambda="$URBAN_PLANNER_ARN" \
  --api-schema 'payload={"openapi":"3.0.0","info":{"title":"Urban Planner API","version":"1.0.0"},"paths":{"/find-optimal-path":{"post":{"description":"Find optimal path","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"start":{"type":"object"},"end":{"type":"object"},"constraints":{"type":"object"}}}}}},"responses":{"200":{"description":"OK"}}}},"/calculate-construction-roi":{"post":{"description":"Calculate ROI","requestBody":{"required":true,"content":{"application/json":{"schema":{"type":"object","properties":{"pathData":{"type":"object"},"constructionCostPerKm":{"type":"number"}}}}}},"responses":{"200":{"description":"OK"}}}}}}' \
  --region "$REGION" || echo "⚠️  Action group may already exist"

echo ""

# Prepare agent to apply changes
echo "🔄 Preparing agent with new action groups..."
aws bedrock-agent prepare-agent \
  --agent-id "$AGENT_ID" \
  --region "$REGION"

echo ""
echo "✅ Agent prepared"
echo ""

echo "🎉 VIGIA Bedrock Agent configuration complete!"
echo ""
echo "The agent now has 4 action groups:"
echo "  1. HazardVerification (existing)"
echo "  2. NetworkIntelligence (new)"
echo "  3. MaintenanceLogistics (new)"
echo "  4. UrbanPlanner (new)"

