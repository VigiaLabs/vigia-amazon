import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface BedrockAgentConfigProps {
  agentId: string;
  agentAliasId: string;
  actionGroupLambdas: {
    hazardVerification: lambda.IFunction;
    networkIntelligence: lambda.IFunction;
    maintenanceLogistics: lambda.IFunction;
    urbanPlanner: lambda.IFunction;
  };
}

/**
 * Outputs configuration for Bedrock Agent
 * Note: Bedrock Agent L1 constructs not yet available in CDK
 * Use the output values to configure agent via AWS Console or CLI
 */
export class BedrockAgentConfig extends Construct {
  constructor(scope: Construct, id: string, props: BedrockAgentConfigProps) {
    super(scope, id);

    // Grant Bedrock service permission to invoke all Lambdas
    const bedrockPrincipal = new iam.ServicePrincipal('bedrock.amazonaws.com', {
      conditions: {
        StringEquals: {
          'aws:SourceAccount': cdk.Stack.of(this).account,
        },
        ArnLike: {
          'aws:SourceArn': `arn:aws:bedrock:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:agent/${props.agentId}`,
        },
      },
    });

    Object.values(props.actionGroupLambdas).forEach(fn => {
      fn.grantInvoke(bedrockPrincipal);
    });

    // Output configuration
    new cdk.CfnOutput(this, 'AgentId', {
      value: props.agentId,
      description: 'Bedrock Agent ID (existing)',
    });

    new cdk.CfnOutput(this, 'AgentAliasId', {
      value: props.agentAliasId,
      description: 'Bedrock Agent Alias ID (existing)',
    });

    new cdk.CfnOutput(this, 'HazardVerificationLambdaArn', {
      value: props.actionGroupLambdas.hazardVerification.functionArn,
      description: 'Lambda ARN for Hazard Verification action group',
    });

    new cdk.CfnOutput(this, 'NetworkIntelligenceLambdaArn', {
      value: props.actionGroupLambdas.networkIntelligence.functionArn,
      description: 'Lambda ARN for Network Intelligence action group',
    });

    new cdk.CfnOutput(this, 'MaintenanceLogisticsLambdaArn', {
      value: props.actionGroupLambdas.maintenanceLogistics.functionArn,
      description: 'Lambda ARN for Maintenance Logistics action group',
    });

    new cdk.CfnOutput(this, 'UrbanPlannerLambdaArn', {
      value: props.actionGroupLambdas.urbanPlanner.functionArn,
      description: 'Lambda ARN for Urban Planner action group',
    });

    // Output agent instruction
    new cdk.CfnOutput(this, 'AgentInstruction', {
      value: `You are VIGIA's infrastructure intelligence agent. You can: 1) Verify hazards using historical data 2) Analyze DePIN network health and coverage gaps 3) Prioritize maintenance tasks and estimate costs 4) Propose optimal road paths to bypass hazard zones. Always provide clear reasoning.`,
      description: 'Agent instruction (copy to Bedrock Console)',
    });
  }
}
