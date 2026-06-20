#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { VigiaStack } from '../lib/vigia-stack';

const app = new cdk.App();

new VigiaStack(app, 'VigiaStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: 'VIGIA: Sentient Road Infrastructure System',
});

// Policy-as-code security guardrail (cdk-nag, AwsSolutions pack).
// Report-only by default so it never blocks normal synth/deploy; run with
// `CDK_NAG=1 cdk synth` to surface findings (auth=NONE routes, CORS *, missing PITR,
// unrotated secrets, over-broad IAM, etc.). `CDK_NAG=error` to fail the build (CI gate).
if (process.env.CDK_NAG) {
  cdk.Aspects.of(app).add(new AwsSolutionsChecks({
    verbose: true,
    logIgnores: false,
  }));
}

app.synth();
