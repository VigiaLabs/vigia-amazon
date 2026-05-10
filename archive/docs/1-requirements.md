# VIGIA: System Requirements Specification

**Project**: Sentient Road Infrastructure System  
**Competition**: Amazon 10,000 AIdeas (Semi-Finalist)  
**Version**: 2.0 (Consolidated)  
**Last Updated**: March 3, 2026  
**Status**: Production - All Features Implemented

---

## 1. Executive Summary

VIGIA transforms smartphones into a real-time "sentient infrastructure" for road safety using a Hybrid Hierarchical Multi-Agent System (H-HMAS). The system enables:
- Client-side AI hazard detection via ONNX Runtime Web
- Bedrock Agent verification with explainable reasoning
- DePIN ledger with cryptographic hash chain
- Real-time route visualization with hazard avoidance
- Infrastructure temporal auditing and scenario simulation

**Target Users**: City engineers, transportation planners, insurance actuaries, public works departments, general public

---

## 2. Core Functional Requirements

### 2.1 Edge Telemetry Generation (Zone 1)

**REQ-1.1**: Video Processing
- **REQ-1.1.1**: System SHALL extract frames at 5 FPS from uploaded dashcam video
- **REQ-1.1.2**: System SHALL perform object detection using YOLOv8-nano via ONNX Runtime Web in dedicated Web Worker
- **REQ-1.1.3**: System SHALL generate telemetry for hazards with confidence ≥ 0.6 containing:
  - Hazard type (POTHOLE, DEBRIS, ACCIDENT, ANIMAL)
  - GPS coordinates (lat, lon)
  - Timestamp (ISO 8601 UTC)
  - Confidence score (0.0–1.0)
- **REQ-1.1.4**: System SHALL cryptographically sign telemetry using Web Crypto API (ECDSA P-256)
- **REQ-1.1.5**: System SHALL batch detections from 5-second windows before transmission

**REQ-1.2**: Privacy Controls
- **REQ-1.2.1**: System SHALL provide privacy toggle to blur faces/license plates
- **REQ-1.2.2**: System SHALL apply blur filter client-side before AI processing

### 2.2 Ingestion & Validation (Zone 2)

**REQ-2.1**: API Gateway
- **REQ-2.1.1**: System SHALL validate telemetry payload schema (JSON Schema v7)
- **REQ-2.1.2**: System SHALL reject invalid signatures with HTTP 400
- **REQ-2.1.3**: System SHALL compute geohash (precision 7) from GPS coordinates
- **REQ-2.1.4**: System SHALL write validated records to DynamoDB with:
  - Partition Key: `geohash`
  - Sort Key: `timestamp`
  - Attributes: `hazardType`, `lat`, `lon`, `confidence`, `signature`, `status`

### 2.3 Intelligence Layer (Zone 3)

**REQ-3.1**: Hazard Verification
- **REQ-3.1.1**: System SHALL check cooldown table (TTL=300s) to prevent duplicate processing
- **REQ-3.1.2**: System SHALL invoke Bedrock Agent (Nova Lite) for new hazards
- **REQ-3.1.3**: Bedrock Agent SHALL:
  - Query DynamoDB for similar hazards within 500m radius in past 24 hours
  - Calculate verification score (0–100) based on spatial clustering, confidence, and temporal patterns
  - Determine if hazard requires immediate alert or passive logging
- **REQ-3.1.4**: System SHALL store reasoning traces (Thought→Action→Observation) in DynamoDB
- **REQ-3.1.5**: System SHALL mark hazards as "verified" if score ≥ 70

**REQ-3.2**: Real-Time Thinking Visualization
- **REQ-3.2.1**: System SHALL stream agent reasoning steps in real-time
- **REQ-3.2.2**: System SHALL display thinking steps sequentially with visual indicators:
  - 💭 Thought (agent reasoning)
  - ▸ Action (tool invocation)
  - → Observation (tool result)
- **REQ-3.2.3**: System SHALL show final reasoning and verification score upon completion

### 2.4 Trust Layer (Zone 4)

**REQ-4.1**: DePIN Ledger
- **REQ-4.1.1**: System SHALL write append-only records to ledger for verified hazards containing:
  - `contributorId` (anonymized hash)
  - `hazardId` (reference to hazard)
  - `credits` (reward value)
  - `previousHash` (SHA-256 of prior entry)
  - `currentHash` (SHA-256 of current entry + previousHash)
- **REQ-4.1.2**: System SHALL validate hash chain integrity via DynamoDB Stream trigger
- **REQ-4.1.3**: System SHALL raise critical alert if hash chain is broken

### 2.5 Visualization & Routing (Zone 5)

**REQ-5.1**: Map Visualization
- **REQ-5.1.1**: System SHALL use Amazon Location Service for base route calculation
- **REQ-5.1.2**: System SHALL:
  - Decode polyline into lat/lon coordinates
  - Generate geohashes for points along route (every 100m)
  - Query DynamoDB for verified hazards matching geohashes
- **REQ-5.1.3**: System SHALL render routes on MapLibre GL JS with segments colored:
  - Red: Within 50m of verified hazard
  - Green: No hazards detected
- **REQ-5.1.4**: System SHALL overlay hazard markers with type-specific icons and verification scores
- **REQ-5.1.5**: System SHALL display scrolling ticker showing recent verified contributions

---

## 3. Innovation Features Requirements

### 3.1 Infrastructure "Diff" Tool (Temporal Auditing)

**REQ-6.1**: File Comparison
- **REQ-6.1.1**: User SHALL drag-and-drop `.map` files to compare infrastructure state over time
- **REQ-6.1.2**: System SHALL compute diff within 2 seconds for files containing up to 500 hazards
- **REQ-6.1.3**: System SHALL render diff visualization with:
  - RED markers: New hazards (present in File B, absent in File A)
  - GREEN markers: Fixed hazards (present in File A, absent in File B)
  - ORANGE markers: Deteriorating hazards (severity increased)
- **REQ-6.1.4**: Diff state SHALL remain local-only unless user explicitly saves
- **REQ-6.1.5**: System SHALL display legend with hazard count deltas

**REQ-6.2**: Export Capabilities
- **REQ-6.2.1**: System SHALL export diff analysis as JSON report
- **REQ-6.2.2**: Report SHALL include geohash coordinates, timestamps, severity changes

### 3.2 Scenario "Branching" (What-If Routing)

**REQ-7.1**: Branch Creation
- **REQ-7.1.1**: User SHALL right-click `.map` files to create simulation branches
- **REQ-7.1.2**: System SHALL create `.scmap` files with naming convention `Session-YYYY-MM-DD-branch-N.scmap`
- **REQ-7.1.3**: Branch files SHALL inherit all hazards from parent `.map` file
- **REQ-7.1.4**: System SHALL display branch files with distinct icon in file explorer
- **REQ-7.1.5**: Branch creation SHALL complete in <500ms

**REQ-7.2**: Simulation Capabilities
- **REQ-7.2.1**: User SHALL toggle hazards on/off in branch view
- **REQ-7.2.2**: User SHALL manually add simulated hazards via map click
- **REQ-7.2.3**: Simulated changes SHALL display with dashed borders
- **REQ-7.2.4**: Changes SHALL persist only in `.scmap` file, never in parent `.map`

**REQ-7.3**: Route Recomputation
- **REQ-7.3.1**: User SHALL trigger route recompilation for branch scenarios
- **REQ-7.3.2**: System SHALL invoke Bedrock Agent with branch context
- **REQ-7.3.3**: System SHALL display comparison widget showing:
  - Baseline average latency
  - Branch average latency
  - Delta percentage
  - Number of affected routes

### 3.3 Explainable AI (ReAct Logs)

**REQ-8.1**: Live Streaming
- **REQ-8.1.1**: System SHALL stream agent traces via Server-Sent Events (SSE)
- **REQ-8.1.2**: System SHALL display ReAct pattern (Thought → Action → Observation → Final Answer)
- **REQ-8.1.3**: System SHALL use virtual scrolling for 1000+ traces
- **REQ-8.1.4**: System SHALL support search/filter by geohash or contributor ID

**REQ-8.2**: Trace Management
- **REQ-8.2.1**: System SHALL store traces in DynamoDB with 7-day TTL
- **REQ-8.2.2**: System SHALL provide auto-scroll toggle
- **REQ-8.2.3**: System SHALL support trace export for debugging

### 3.4 Economic Layer

**REQ-9.1**: Maintenance Reporting
- **REQ-9.1.1**: User SHALL submit maintenance reports for hazards
- **REQ-9.1.2**: System SHALL auto-calculate repair costs using formula:
  - `baseCost[type] * (1 + severity * 0.2)`
- **REQ-9.1.3**: System SHALL require ECDSA signature for report validation
- **REQ-9.1.4**: System SHALL maintain maintenance queue with status tracking

**REQ-9.2**: ROI Metrics
- **REQ-9.2.1**: System SHALL display ROI widget showing:
  - Total hazards detected
  - Estimated repair cost
  - Prevented damage cost
  - ROI multiplier
  - Hazard breakdown by type
- **REQ-9.2.2**: System SHALL update metrics in real-time
- **REQ-9.2.3**: ROI widget SHALL update in <1 second

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-1**: Client-Side Performance
- **NFR-1.1**: Video frame processing SHALL not block main UI thread (target: <16ms tasks)
- **NFR-1.2**: ONNX inference SHALL complete within 200ms on mid-range laptop
- **NFR-1.3**: Diff computation SHALL complete in <2s for 500 hazards
- **NFR-1.4**: Branch rendering SHALL maintain 60fps with 100 simulated hazards

**NFR-2**: Server-Side Performance
- **NFR-2.1**: API Gateway SHALL respond within 500ms (p95 latency)
- **NFR-2.2**: Map tiles and routes SHALL render within 1 second
- **NFR-2.3**: ReAct streaming SHALL have <500ms latency
- **NFR-2.4**: ROI widget SHALL update in <1s

### 4.2 Scalability

**NFR-3**: System Capacity
- **NFR-3.1**: System SHALL handle 500 concurrent users during voting phase
- **NFR-3.2**: DynamoDB SHALL use on-demand billing to prevent throttling
- **NFR-3.3**: Lambda functions SHALL auto-scale to handle traffic spikes
- **NFR-3.4**: System SHALL cache routes aggressively to minimize API calls

### 4.3 Cost Optimization

**NFR-4**: Budget Constraints
- **NFR-4.1**: System SHALL stay within AWS Free Tier + $200 credits
- **NFR-4.2**: Estimated cost SHALL be <$1.50 for 7-day voting phase
- **NFR-4.3**: Innovation features SHALL cost <$0.50/day for 100 users
- **NFR-4.4**: System SHALL use Amazon Nova Lite (not Claude 3.5 Sonnet)

### 4.4 Security

**NFR-5**: Data Protection
- **NFR-5.1**: All telemetry SHALL be cryptographically signed
- **NFR-5.2**: Signature verification SHALL reject invalid payloads
- **NFR-5.3**: Contributor IDs SHALL be anonymized in public traces
- **NFR-5.4**: DynamoDB SHALL use encryption at rest
- **NFR-5.5**: API Gateway SHALL enforce CORS policies

**NFR-6**: Privacy
- **NFR-6.1**: No raw video SHALL be transmitted to cloud
- **NFR-6.2**: Client-side blur filter SHALL anonymize faces/plates
- **NFR-6.3**: Trace data SHALL have 7-day TTL
- **NFR-6.4**: Branch files SHALL remain local-only

### 4.5 Reliability

**NFR-7**: System Availability
- **NFR-7.1**: System SHALL have 99.9% uptime during voting phase
- **NFR-7.2**: Hash chain validator SHALL raise alerts for integrity violations
- **NFR-7.3**: System SHALL implement exponential backoff for failed API calls
- **NFR-7.4**: CloudWatch alarms SHALL monitor cost, errors, and latency

### 4.6 Usability

**NFR-8**: User Experience
- **NFR-8.1**: UI SHALL follow monochrome design system (#FFFFFF, #F5F5F5, #CBD5E1)
- **NFR-8.2**: UI SHALL use Inter font for UI elements, JetBrains Mono for data/logs
- **NFR-8.3**: Layout SHALL follow VS Code IDE pattern (Sidebar | Main Stage | Console)
- **NFR-8.4**: All features SHALL be accessible via keyboard shortcuts
- **NFR-8.5**: System SHALL provide visual feedback for all user actions

---

## 5. Acceptance Criteria

### 5.1 Core System

**AC-1**: End-to-End Flow
- User uploads video → frames extracted → hazards detected → telemetry signed → API accepts → DynamoDB stores → Bedrock verifies → ledger updated → map displays

**AC-2**: Verification Process
- Hazard with score ≥70 marked as "verified"
- Reasoning trace stored in DynamoDB
- DePIN ledger entry created with valid hash chain

**AC-3**: Visualization
- Routes colored red/green based on hazards
- Hazard markers clickable with tooltips
- Ledger ticker scrolls recent contributions

### 5.2 Innovation Features

**AC-4**: Diff Tool
- Drag-and-drop triggers diff computation in <2s
- RED/GREEN/ORANGE markers render correctly
- Legend shows accurate hazard count deltas

**AC-5**: Scenario Branching
- Right-click creates `.scmap` file in <500ms
- Toggle hazards updates branch state
- Route recomputation returns latency comparison

**AC-6**: ReAct Logs
- SSE stream delivers traces in real-time
- Virtual scrolling handles 1000+ traces
- Search/filter works without re-fetching

**AC-7**: Economic Layer
- Maintenance report submission calculates cost correctly
- ROI widget updates in <1s
- Maintenance queue tracks status changes

### 5.3 Performance

**AC-8**: All performance targets met:
- Diff: <2s for 500 hazards ✅
- Branch: 60fps rendering ✅
- ReAct: <500ms latency ✅
- ROI: <1s update ✅

### 5.4 Cost

**AC-9**: Budget compliance:
- Total cost <$1.50 for 7-day voting phase ✅
- All services within AWS Free Tier ✅
- Innovation features <$0.50/day ✅

---

## 6. Out of Scope

The following are explicitly NOT included in the current implementation:

1. **Mobile App**: Web-only, no native iOS/Android apps
2. **Real-Time GPS**: Uses simulated coordinates for demo
3. **Production ONNX Model**: Placeholder model, not trained on real potholes
4. **Multi-User Collaboration**: Single-user experience
5. **Payment Processing**: No actual credit/token transactions
6. **Advanced Analytics**: Basic metrics only, no ML-based predictions
7. **Offline Mode**: Requires internet connection
8. **Video Streaming**: Upload-only, no live camera feed

---

## 7. Future Enhancements

Potential features for post-competition development:

1. **Mobile SDK**: Native iOS/Android libraries for real-time detection
2. **Custom ONNX Model**: Train on real pothole dataset
3. **WebSocket Streaming**: True real-time trace updates
4. **Multi-Tenant Support**: City-specific dashboards
5. **Advanced Routing**: Integration with Waze/Google Maps
6. **Blockchain Integration**: Replace DynamoDB ledger with actual blockchain
7. **Gamification**: Leaderboards, badges, challenges
8. **API Marketplace**: Allow third-party integrations

---

**Document Status**: ✅ Complete - All requirements implemented and tested
