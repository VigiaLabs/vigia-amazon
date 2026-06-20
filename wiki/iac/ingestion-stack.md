---
title: "IngestionStack"
type: iac
tags: [#iac]
source: packages/infrastructure/lib/stacks/ingestion-stack.ts
related: ["[[api-gateway-telemetry]]", "[[iot-core]]", "[[validator-fn]]", "[[attestation-fn]]", "[[register-device-fn]]", "[[claim-device-fn]]", "[[stripe-payout-fn]]", "[[sarvam-proxy-fn]]", "[[hazards-table]]", "[[vigia-pi-device-registry]]", "[[vigia-device-registry]]", "[[device-bindings-table]]", "[[attestation-log-table]]", "[[s3-frames-bucket]]", "[[secrets-manager]]", "[[vigia-stack]]"]
updated: 2026-06-20
---

# IngestionStack

AWS CDK Construct hosting all ingestion-layer resources: telemetry API, IoT Core, device registries, S3 frames bucket, Stripe/Sarvam proxies.

**File:** `packages/infrastructure/lib/stacks/ingestion-stack.ts`

## Resources Owned

**Tables:** [[hazards-table]], [[vigia-pi-device-registry]], [[vigia-device-registry]], [[device-bindings-table]], [[attestation-log-table]]

**S3:** [[s3-frames-bucket]]

**IoT:** [[iot-core]] (CfnTopicRule `vigia_hazard_attest`, CfnPolicy `vigia-pi-device-policy`)

**Secrets:** refs to `vigia/stripe-secret-key`, `vigia/stripe-publishable-key`, `vigia/sarvam-api-key`

**Lambdas:** [[validator-fn]], [[attestation-fn]], [[register-device-fn]], [[claim-device-fn]], [[stripe-payout-fn]], [[sarvam-proxy-fn]], [[ledger-getter-fn]], [[hazards-getter-fn]], [[traces-getter-fn]], [[agent-chat-fn]]

**API:** [[api-gateway-telemetry]] (REST API, `prod` stage, 100 RPS throttle / 200 burst)

## Links

- See resource links above; [[vigia-stack]] instantiates this
