---
title: "ADR: IoT Core replaces Mosquitto/FastAPI"
type: decision
tags: [#decision, ingestion]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[iot-core]]", "[[attestation-fn]]", "[[hazard-attestation-flow]]"]
updated: 2026-06-20
---

# ADR: IoT Core Replaces Mosquitto/FastAPI (M12)

## Context

Prior to M12, Pi nodes connected to a self-hosted Mosquitto MQTT broker + Python FastAPI server on an EC2 instance. This required maintaining a persistent TCP server and handling MQTT connection state manually.

## Decision

Replace with AWS IoT Core managed MQTT + IoT Topic Rule → Lambda.

## Rationale

- **No server management:** IoT Core handles MQTT connection scaling, TLS termination, and device authentication.
- **Built-in X.509 device authentication:** IoT Core can enforce certificate-based mutual TLS before the payload reaches Lambda.
- **Topic Rule SQL filtering:** Pre-Lambda filtering (e.g., route only `vigia/attest/+/hazard` topics) reduces Lambda invocations.
- **CfnPolicy `vigia-pi-device-policy`:** Scopes device permissions to specific publish topics; enforced at IoT Core layer.

## Consequences

- MQTT payloads arrive as Base64 via the IoT Rule SQL `encode(*,'base64')` action.
- [[attestation-fn]] must decode MsgPack from Base64.
- IoT Core `CfnTopicRule` is provisioned via CDK (IaC), not a long-running process.

## Links

- [[iot-core]] — the AWS service that replaced Mosquitto
- [[attestation-fn]] — Lambda triggered by the IoT Rule
- [[hazard-attestation-flow]] — full flow
