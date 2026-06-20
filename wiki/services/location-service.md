---
title: "Amazon Location Service"
type: aws-service
tags: [#aws-service, session]
source: packages/infrastructure/lib/stacks/intelligence-stack.ts, packages/infrastructure/lib/stacks/session-stack.ts
related: ["[[urban-planner-fn]]", "[[geohash-resolver-fn]]", "[[places-search-fn]]", "[[step-functions-urban-planner]]", "[[intelligence-stack]]", "[[session-stack]]"]
updated: 2026-06-20
---

# Amazon Location Service

Two resource types used: **Geofence Collection** and **Route Calculator**.

## Geofence Collection

CDK resource: `location.CfnGeofenceCollection` (`{stackName}-RestrictedZones`).

Used by [[step-functions-urban-planner]] sub-Lambdas (`GenerateBezierPathFn`, `CheckZoneRegulationsFn`) via `geo:BatchEvaluateGeofences` to check urban planning zone restrictions. Individual geofences (residential, commercial, industrial, protected zones) are added post-deploy via API/CLI.

## Route Calculator

CDK resource: `location.CfnRouteCalculator` (`{stackName}-RouteCalc`, data source: `Esri`).

Used by [[urban-planner-fn]] via `geo:CalculateRoute` for route computation in the Bedrock action group.

## Reverse Geocoding

- [[geohash-resolver-fn]] calls `geo-places:ReverseGeocode` (granted via IAM `resources: ['*']`)
- [[places-search-fn]] calls `geo-places:SearchText` and `geo-places:ReverseGeocode`

## Links

- [[urban-planner-fn]] — Route Calculator caller
- [[geohash-resolver-fn]] — ReverseGeocode caller
- [[places-search-fn]] — SearchText + ReverseGeocode caller
- [[step-functions-urban-planner]] — geofence evaluation caller
- [[intelligence-stack]], [[session-stack]] — CDK constructs owning these resources
