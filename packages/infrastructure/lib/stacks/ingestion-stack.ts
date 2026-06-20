import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as iot from 'aws-cdk-lib/aws-iot';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface IngestionStackProps {
  ledgerTable: dynamodb.Table;
  tracesTable: dynamodb.Table;
  deviceRegistryTable?: dynamodb.Table;
}

export class IngestionStack extends Construct {
  // ── DynamoDB tables (public — referenced by other stacks) ────────────────
  public readonly hazardsTable: dynamodb.Table;
  public readonly deviceRegistryTable: dynamodb.Table;    // mobile wallets (device_address PK)
  public readonly piDeviceRegistryTable: dynamodb.Table;  // Pi hardware units (device_id PK)
  public readonly deviceBindingsTable: dynamodb.Table;    // 1:1 device ↔ wallet

  // ── Other public resources ───────────────────────────────────────────────
  public readonly framesbucket: s3.Bucket;
  public readonly api: apigateway.RestApi;
  public readonly stripePayoutFn: lambdaNodejs.NodejsFunction;
  public readonly stripeWebhookFn: lambdaNodejs.NodejsFunction;  // P0-4: async settlement reconciliation

  constructor(scope: Construct, id: string, props: IngestionStackProps) {
    super(scope, id);

    // ── HazardsTable (mobile-submitted + hardware-attested hazards) ──────────
    this.hazardsTable = new dynamodb.Table(this, 'HazardsTable', {
      pointInTimeRecovery: true,  // P1 fix: recover hazard/reward-linked data after a bad write
      partitionKey: { name: 'geohash',    type: dynamodb.AttributeType.STRING },
      sortKey:      { name: 'timestamp',  type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      stream:       dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.hazardsTable.addGlobalSecondaryIndex({
      indexName:      'status-timestamp-index',
      partitionKey:   { name: 'status',     type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'timestamp',  type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // H3 resolution-10 dedup index — used by AttestationFn to merge hardware events.
    this.hazardsTable.addGlobalSecondaryIndex({
      indexName:      'h3-hazardtype-index',
      partitionKey:   { name: 'h3_index',   type: dynamodb.AttributeType.STRING },
      sortKey:        { name: 'hazardType', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ['timestamp', 'status', 'geohash'],
    });

    // ── VigiaDeviceRegistry — mobile wallet registrations (device_address = base58 Ed25519 pubkey) ──
    this.deviceRegistryTable = new dynamodb.Table(this, 'DeviceRegistryTable', {
      pointInTimeRecovery: true,  // P1 fix: identity table — recover wallet registrations
      // No explicit tableName — CDK auto-generates to avoid conflict with the
      // pre-existing VigiaDeviceRegistry table (7 legacy records, not CF-managed).
      // After deploy: migrate records from VigiaDeviceRegistry → this table's name.
      partitionKey: { name: 'device_address', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── PiDeviceRegistryTable — Pi hardware units, provisioned via sign-device script ──
    // device_id: ATECC608A serial-derived ID (e.g. "vigia-001")
    // cert_pem:  X.509 device certificate (PEM) issued by Vigia CA → IoT Core
    // last_seq:  anti-replay watermark (updated atomically by AttestationFn)
    // No explicit tableName: combined with removalPolicy RETAIN, a fixed name would
    // orphan the table on every rollback and collide on the next deploy. CDK
    // auto-generates a stable per-stack name; consumers reference it via .tableName.
    this.piDeviceRegistryTable = new dynamodb.Table(this, 'PiDeviceRegistryTable', {
      pointInTimeRecovery: true,  // P1 fix: holds cert_pem — recover attestation identity
      partitionKey: { name: 'device_id', type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,   // retain — contains cert_pem, losing this loses attestation
    });

    // ── DeviceBindingsTable — 1:1 hardware ↔ wallet binding (immutable once set) ──
    // UNIQUE on device_id (PK) + UNIQUE on wallet_pubkey (GSI) = bidirectional exclusivity.
    // Auto-named for the same orphan-on-rollback reason as PiDeviceRegistryTable.
    this.deviceBindingsTable = new dynamodb.Table(this, 'DeviceBindingsTable', {
      pointInTimeRecovery: true,  // P1 fix: losing bindings breaks reward attribution
      partitionKey: { name: 'device_id',    type: dynamodb.AttributeType.STRING },
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,   // retain — losing bindings breaks reward attribution
    });

    this.deviceBindingsTable.addGlobalSecondaryIndex({
      indexName:      'wallet-pubkey-index',
      partitionKey:   { name: 'wallet_pubkey', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Surface the auto-generated names so the Pi-provisioning step can seed them.
    new cdk.CfnOutput(this, 'PiDeviceRegistryTableName', { value: this.piDeviceRegistryTable.tableName });
    new cdk.CfnOutput(this, 'DeviceBindingsTableName',   { value: this.deviceBindingsTable.tableName });

    // ── AttestationLogTable — append-only verified event log ─────────────────
    const attestationLogTable = new dynamodb.Table(this, 'AttestationLogTable', {
      pointInTimeRecovery: true,  // P1 fix: append-only verified-event audit log
      tableName:    'VigiaAttestationLog',
      partitionKey: { name: 'pk',         type: dynamodb.AttributeType.STRING }, // device_id#seq
      billingMode:  dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ── S3 frame store (30-day lifecycle) ────────────────────────────────────
    this.framesbucket = new s3.Bucket(this, 'HazardFramesBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy:     cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });

    // ── Lambda: ValidatorFn — mobile telemetry ingest (Ed25519 verify) ───────
    const validatorFn = new lambdaNodejs.NodejsFunction(this, 'ValidatorFunction', {
      entry:   path.join(__dirname, '../../../backend/src/validator/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: {
        HAZARDS_TABLE_NAME:          this.hazardsTable.tableName,
        DEVICE_REGISTRY_TABLE_NAME:  this.deviceRegistryTable.tableName,
        FRAMES_BUCKET_NAME:          this.framesbucket.bucketName,
      },
    });
    this.hazardsTable.grantWriteData(validatorFn);
    this.deviceRegistryTable.grantReadData(validatorFn);
    this.framesbucket.grantPut(validatorFn);

    // ── Lambda: RegisterDeviceFn — mobile wallet self-registration ───────────
    const registerDeviceFn = new lambdaNodejs.NodejsFunction(this, 'RegisterDeviceFunction', {
      entry:   path.join(__dirname, '../../../backend/functions/register-device/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: { DEVICE_REGISTRY_TABLE_NAME: this.deviceRegistryTable.tableName },
    });
    this.deviceRegistryTable.grantWriteData(registerDeviceFn);

    // ── Lambda: ClaimDeviceFn — 1:1 device/wallet binding enforcement ────────
    const claimDeviceFn = new lambdaNodejs.NodejsFunction(this, 'ClaimDeviceFunction', {
      entry:   path.join(__dirname, '../../../backend/functions/claim-device/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: {
        DEVICE_BINDINGS_TABLE_NAME: this.deviceBindingsTable.tableName,
        // P0-6: claim-device verifies the Pi's ECDSA proof against its registered cert.
        PI_DEVICE_REGISTRY_TABLE_NAME: this.piDeviceRegistryTable.tableName,
      },
    });
    this.deviceBindingsTable.grantReadWriteData(claimDeviceFn);
    this.piDeviceRegistryTable.grantReadData(claimDeviceFn);

    // ── Lambda: AttestationFn — IoT Core MQTT → hardware attestation pipeline ─
    // Replaces FastAPI server + Mosquitto broker + attestation.py entirely.
    const attestationFn = new lambdaNodejs.NodejsFunction(this, 'AttestationFunction', {
      entry:      path.join(__dirname, '../../../backend/functions/attestation/index.ts'),
      handler:    'handler',
      runtime:    lambda.Runtime.NODEJS_20_X,
      timeout:    cdk.Duration.seconds(30),
      memorySize: 512,
      logRetention: logs.RetentionDays.ONE_MONTH,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        // @msgpack/msgpack and @noble/curves are pure-JS — esbuild bundles them.
      },
      environment: {
        PI_DEVICE_REGISTRY_TABLE_NAME: this.piDeviceRegistryTable.tableName,
        HAZARDS_TABLE_NAME:            this.hazardsTable.tableName,
        ATTESTATION_LOG_TABLE_NAME:    attestationLogTable.tableName,
      },
    });
    this.piDeviceRegistryTable.grantReadWriteData(attestationFn);
    this.hazardsTable.grantReadWriteData(attestationFn);
    attestationLogTable.grantWriteData(attestationFn);

    // Allow IoT Core service to invoke AttestationFn directly via topic rule action.
    attestationFn.addPermission('IoTCoreInvoke', {
      principal:  new iam.ServicePrincipal('iot.amazonaws.com'),
      sourceArn:  `arn:aws:iot:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:rule/vigia_hazard_attest`,
    });

    // ── IoT Core Topic Rule — triggers AttestationFn for every Pi MQTT publish ─
    // Pi publishes binary MsgPack; IoT SQL wraps it in base64 + topic metadata.
    // All three fields are consumed by AttestationFn.
    new iot.CfnTopicRule(this, 'HazardAttestRule', {
      ruleName: 'vigia_hazard_attest',
      topicRulePayload: {
        sql: "SELECT encode(*, 'base64') AS payload, topic() AS topic, timestamp() AS ts FROM 'vigia/attest/+/hazard'",
        awsIotSqlVersion: '2016-03-23',
        ruleDisabled: false,
        actions: [{
          lambda: { functionArn: attestationFn.functionArn },
        }],
        // Error action: log rule failures to CloudWatch
        errorAction: {
          cloudwatchLogs: {
            logGroupName: '/vigia/iot/attest-errors',
            roleArn: new iam.Role(this, 'IoTErrorLogRole', {
              assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
              inlinePolicies: {
                LogWrite: new iam.PolicyDocument({
                  statements: [new iam.PolicyStatement({
                    actions:   ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
                    // Scoped to the attest-errors log group (and its streams) only.
                    resources: [
                      `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/vigia/iot/attest-errors:*`,
                    ],
                  })],
                }),
              },
            }).roleArn,
          },
        },
      },
    });

    // ── IoT Core Device Policy — attached to each Pi's device certificate ─────
    // ${iot:ClientId} must equal the device_id (e.g. "vigia-001") so each Pi
    // can only publish to its own topic — prevents cross-device impersonation.
    new iot.CfnPolicy(this, 'PiDevicePolicy', {
      policyName: 'vigia-pi-device-policy',
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect:   'Allow',
            Action:   'iot:Connect',
            Resource: `arn:aws:iot:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:client/\${iot:ClientId}`,
          },
          {
            // Hazard event publish — topic-scoped to device's own clientId
            Effect:   'Allow',
            Action:   'iot:Publish',
            Resource: `arn:aws:iot:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:topic/vigia/attest/\${iot:ClientId}/hazard`,
          },
          {
            // Last-will health publish
            Effect:   'Allow',
            Action:   'iot:Publish',
            Resource: `arn:aws:iot:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:topic/vigia/status/\${iot:ClientId}/health`,
          },
        ],
      },
    });

    // ── Ledger / Traces getter functions ─────────────────────────────────────
    const ledgerGetterFn = new lambdaNodejs.NodejsFunction(this, 'LedgerGetterFunction', {
      entry:   path.join(__dirname, '../../../backend/src/ledger/get-entries.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: { LEDGER_TABLE_NAME: props.ledgerTable.tableName },
    });
    props.ledgerTable.grantReadData(ledgerGetterFn);

    const tracesGetterFn = new lambdaNodejs.NodejsFunction(this, 'TracesGetterFunction', {
      entry:   path.join(__dirname, '../../../backend/src/traces/get-latest.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: { TRACES_TABLE_NAME: props.tracesTable.tableName },
    });
    props.tracesTable.grantReadData(tracesGetterFn);

    const tracesByHazardFn = new lambdaNodejs.NodejsFunction(this, 'TracesByHazardFunction', {
      entry:   path.join(__dirname, '../../../backend/src/traces/get-by-hazard.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: { TRACES_TABLE_NAME: props.tracesTable.tableName },
    });
    props.tracesTable.grantReadData(tracesByHazardFn);

    const hazardsGetterFn = new lambdaNodejs.NodejsFunction(this, 'HazardsGetterFunction', {
      entry:   path.join(__dirname, '../../../backend/src/hazards/get-hazards.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: { HAZARDS_TABLE_NAME: this.hazardsTable.tableName },
    });
    this.hazardsTable.grantReadData(hazardsGetterFn);

    // ── API Gateway ───────────────────────────────────────────────────────────
    this.api = new apigateway.RestApi(this, 'VigiaAPI', {
      restApiName:  'VIGIA Telemetry API',
      description:  'Ingestion + device management endpoints',
      deployOptions: {
        stageName:            'prod',
        throttlingRateLimit:  100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // POST /telemetry — mobile telemetry ingest (Ed25519 signed)
    const telemetryModel = this.api.addModel('TelemetryModel', {
      contentType: 'application/json',
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ['hazardType', 'lat', 'lon', 'timestamp', 'confidence', 'signature'],
        properties: {
          hazardType:          { type: apigateway.JsonSchemaType.STRING, enum: ['POTHOLE', 'DEBRIS', 'ACCIDENT', 'ANIMAL', 'ROUGH_ROAD', 'ROAD_ANOMALY'] },
          lat:                 { type: apigateway.JsonSchemaType.NUMBER, minimum: -90,  maximum: 90  },
          lon:                 { type: apigateway.JsonSchemaType.NUMBER, minimum: -180, maximum: 180 },
          timestamp:           { type: apigateway.JsonSchemaType.STRING, format: 'date-time' },
          confidence:          { type: apigateway.JsonSchemaType.NUMBER, minimum: 0, maximum: 1 },
          signature:           { type: apigateway.JsonSchemaType.STRING },
          driverWalletAddress: { type: apigateway.JsonSchemaType.STRING },
        },
      },
    });
    const telemetry = this.api.root.addResource('telemetry');
    telemetry.addMethod('POST', new apigateway.LambdaIntegration(validatorFn), {
      requestValidator: new apigateway.RequestValidator(this, 'TelemetryValidator', {
        restApi: this.api, validateRequestBody: true,
      }),
      requestModels: { 'application/json': telemetryModel },
    });

    // POST /register-device — mobile wallet self-registration
    const registerDevice = this.api.root.addResource('register-device');
    registerDevice.addMethod('POST', new apigateway.LambdaIntegration(registerDeviceFn));

    // POST /claim-device — 1:1 hardware/wallet binding (replaces FastAPI /v1/claim-device)
    const claimDevice = this.api.root.addResource('claim-device');
    claimDevice.addMethod('POST', new apigateway.LambdaIntegration(claimDeviceFn));

    // ── Stripe payout Lambda (Connect Express + PaymentIntent) ───────────────
    const stripeSecretKey = secretsmanager.Secret.fromSecretNameV2(
      this, 'StripeSecretKeySecret', 'vigia/stripe-secret-key',
    );
    const stripePublishableKey = secretsmanager.Secret.fromSecretNameV2(
      this, 'StripePublishableKeySecret', 'vigia/stripe-publishable-key',
    );

    this.stripePayoutFn = new lambdaNodejs.NodejsFunction(this, 'StripePayoutFunction', {
      entry:      path.join(__dirname, '../../../backend/functions/stripe-payout/index.ts'),
      handler:    'handler',
      runtime:    lambda.Runtime.NODEJS_20_X,
      timeout:    cdk.Duration.seconds(30),
      memorySize: 256,
      bundling:   { externalModules: ['@aws-sdk/*'] },
      environment: {
        REWARDS_LEDGER_TABLE_NAME: '', // injected below after intelligence stack; placeholder here
        STRIPE_SECRET_KEY:         stripeSecretKey.secretValue.unsafeUnwrap(),
        STRIPE_PUBLISHABLE_KEY:    stripePublishableKey.secretValue.unsafeUnwrap(),
        VGA_TO_USD_CENTS:          '100',
      },
    });

    // ── Stripe webhook Lambda (P0-4: async settlement reconciliation) ────────
    const stripeWebhookSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'StripeWebhookSecret', 'vigia/stripe-webhook-secret',
    );
    this.stripeWebhookFn = new lambdaNodejs.NodejsFunction(this, 'StripeWebhookFunction', {
      entry:      path.join(__dirname, '../../../backend/functions/stripe-webhook/index.ts'),
      handler:    'handler',
      runtime:    lambda.Runtime.NODEJS_20_X,
      timeout:    cdk.Duration.seconds(15),
      memorySize: 256,
      bundling:   { externalModules: ['@aws-sdk/*'] },
      environment: {
        REWARDS_LEDGER_TABLE_NAME: '', // injected by vigia-stack.ts after intelligence stack
        STRIPE_SECRET_KEY:         stripeSecretKey.secretValue.unsafeUnwrap(),
        STRIPE_WEBHOOK_SECRET:     stripeWebhookSecret.secretValue.unsafeUnwrap(),
      },
    });

    const stripeResource = this.api.root.addResource('stripe');
    // REWARDS_LEDGER_TABLE_NAME injected by vigia-stack.ts after intelligence stack is created.
    stripeResource.addResource('onboard-session').addMethod('POST',  new apigateway.LambdaIntegration(this.stripePayoutFn));
    stripeResource.addResource('payout-session').addMethod('POST',   new apigateway.LambdaIntegration(this.stripePayoutFn));
    stripeResource.addResource('financial-session').addMethod('POST', new apigateway.LambdaIntegration(this.stripePayoutFn));
    stripeResource.addResource('webhook').addMethod('POST',          new apigateway.LambdaIntegration(this.stripeWebhookFn));

    new cdk.CfnOutput(this, 'StripePayoutFunctionArn', { value: this.stripePayoutFn.functionArn });

    // ── Sarvam AI proxy (keeps API key off mobile client) ────────────────────
    // The key is stored in Secrets Manager and injected as SARVAM_API_KEY at
    // deploy time. Mobile apps call POST /sarvam-proxy/stt and /sarvam-proxy/tts
    // using their Cognito JWT; this Lambda forwards to Sarvam's API.
    const sarvamSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'SarvamApiKeySecret', 'vigia/sarvam-api-key',
    );

    const sarvamProxyFn = new lambdaNodejs.NodejsFunction(this, 'SarvamProxyFunction', {
      entry:   path.join(__dirname, '../../../backend/functions/sarvam-proxy/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      // P0-2 fix (partial): cap blast radius of an open/abused proxy until the
      // Cognito authorizer lands — bounds Sarvam key quota drain + account concurrency.
      reservedConcurrentExecutions: 10,
      bundling: { externalModules: ['@aws-sdk/*'] },
      environment: {
        SARVAM_API_KEY: sarvamSecret.secretValue.unsafeUnwrap(),
      },
    });

    const sarvamProxy = this.api.root.addResource('sarvam-proxy');
    sarvamProxy.addResource('stt').addMethod('POST', new apigateway.LambdaIntegration(sarvamProxyFn));
    sarvamProxy.addResource('tts').addMethod('POST', new apigateway.LambdaIntegration(sarvamProxyFn));

    new cdk.CfnOutput(this, 'SarvamProxyFunctionArn', { value: sarvamProxyFn.functionArn });

    // GET /hazards
    const hazards = this.api.root.addResource('hazards', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    hazards.addMethod('GET', new apigateway.LambdaIntegration(hazardsGetterFn));

    // GET /ledger, GET /traces, GET /traces/{hazardId}
    const ledger = this.api.root.addResource('ledger');
    ledger.addMethod('GET', new apigateway.LambdaIntegration(ledgerGetterFn));

    const traces = this.api.root.addResource('traces', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    traces.addMethod('GET', new apigateway.LambdaIntegration(tracesGetterFn));

    const tracesByHazard = traces.addResource('{hazardId}');
    tracesByHazard.addMethod('GET', new apigateway.LambdaIntegration(tracesByHazardFn));

    // ── POST /v1/road-ahead — route-ahead hazard query for real-time voice copilot ──
    const roadAheadFn = new lambdaNodejs.NodejsFunction(this, 'RoadAheadFunction', {
      entry: path.join(__dirname, '../../../backend/functions/road-ahead/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(8),
      environment: {
        HAZARDS_TABLE_NAME: this.hazardsTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });
    this.hazardsTable.grantReadData(roadAheadFn);

    const v1 = this.api.root.addResource('v1');
    const roadAhead = v1.addResource('road-ahead', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });
    roadAhead.addMethod('POST', new apigateway.LambdaIntegration(roadAheadFn));
  }
}
