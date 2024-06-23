import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  Aws,
  Duration,
  // aws_s3 as s3,
  aws_iam as iam,
  aws_iot as iot,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import {
  // type ICommandHooks,
  NodejsFunction,
  type NodejsFunctionProps,
  OutputFormat,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const esmBanner =
  'import { createRequire as topLevelCreateRequire } from "node:module"; import url from "node:url"; const require = topLevelCreateRequire(import.meta.url); const __filename = url.fileURLToPath(import.meta.url); const __dirname = url.fileURLToPath(new URL(".", import.meta.url));';

const lambdaNodejsBundlingOption = {
  sourceMap: false,
  minify: true,
  format: OutputFormat.ESM,
  tsconfig: path.join(__dirname, '../../../../lambda/tsconfig.json'),
  banner: esmBanner,
  externalModules: ['@aws-sdk/*'],
} as const satisfies NodejsFunctionProps['bundling'];

const iotPolicyVars = {
  thingNameVar: '${iot:Connection.Thing.ThingName}',
} as const;

export interface FleetProvisioningSettingProps {
  readonly stageName: string;
  readonly iotPolicyForDeviceDocument: iam.PolicyDocument;
}

export class FleetProvisioningSetting extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: FleetProvisioningSettingProps,
  ) {
    super(scope, id);

    const roleForFleetProvisioning = new iam.Role(
      this,
      'role-FleetProvisioning',
      {
        roleName: 'Role-for-FleetProvisioning',
        assumedBy: new iam.ServicePrincipal('iot.amazonaws.com'),
      },
    );
    roleForFleetProvisioning.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSIoTThingsRegistration',
      ),
    );

    const roleForFleetProvisioningHookLambda = new iam.Role(
      this,
      'Role-FleetProvisioning-Hook',
      {
        roleName: 'Role-FleetProvisioning-Hook',
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      },
    );
    roleForFleetProvisioningHookLambda.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSLambdaBasicExecutionRole',
      ),
    );

    const functionPreProvisioningHook = new NodejsFunction(
      this,
      'pre-provisioning-hook',
      {
        functionName: 'LambdaFunction-pre-provisioning-hook',
        handler: 'handler',
        entry: path.join(
          __dirname,
          '../../../../lambda/functions/iot/pre-provisioning-hook.ts',
        ),
        runtime: lambda.Runtime.NODEJS_20_X,
        bundling: lambdaNodejsBundlingOption,
        timeout: Duration.seconds(30),
        memorySize: 256,
        environment: {
          POWERTOOLS_LOG_LEVEL: 'DEBUG', // TODO: enable to change dynamically
          POWERTOOLS_SERVICE_NAME: 'iot-FP-pre-provisioning-hook-example',
        },
        tracing: lambda.Tracing.ACTIVE,
        architecture: lambda.Architecture.ARM_64,
      },
    );
    functionPreProvisioningHook.grantInvoke(
      new iam.ServicePrincipal('iot.amazonaws.com'),
    );

    const provisioningTemplate = new iot.CfnProvisioningTemplate(
      this,
      'provisioning-template',
      {
        // tags: [],
        templateName: 'example-fleet-provisioning-template',
        provisioningRoleArn: roleForFleetProvisioning.roleArn,
        preProvisioningHook: {
          payloadVersion: '2020-04-01',
          targetArn: functionPreProvisioningHook.functionArn,
        },
        enabled: true,
        templateBody: JSON.stringify({
          Parameters: {
            SerialNumber: {
              Type: 'String',
            },
            CreateDateTime: {
              Type: 'String',
            },
          },
          Resources: {
            thing: {
              Type: 'AWS::IoT::Thing',
              Properties: {
                AttributePayload: {
                  SerialNumber: { Ref: 'SerialNumber' },
                  CreateDateTime: { Ref: 'CreateDateTime' },
                },
                ThingName: {
                  'Fn::Join': ['_', ['FPTest', { Ref: 'SerialNumber' }]],
                },
              },
              OverrideSettings: {
                AttributePayload: 'MERGE',
              },
            },
            certificate: {
              Type: 'AWS::IoT::Certificate',
              Properties: {
                CertificateId: { Ref: 'AWS::IoT::Certificate::Id' },
                Status: 'Active',
              },
            },
            policy: {
              Type: 'AWS::IoT::Policy',
              Properties: {
                PolicyDocument: props.iotPolicyForDeviceDocument.toJSON(),
              },
            },
          },
          DeviceConfiguration: {
            DeviceCreateDate: { Ref: 'CreateDateTime' },
          },
        }),
      },
    );
    provisioningTemplate.node.addDependency(functionPreProvisioningHook);

    new iot.CfnPolicy(this, 'ExampleClaimIoTPolicy', {
      policyDocument: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:Connect'],
            resources: ['*'],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:Publish', 'iot:Receive'],
            resources: [
              `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/\$aws/certificates/create/*`,
              `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/\$aws/provisioning-templates/${provisioningTemplate.templateName}/provision/*`,
            ],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['iot:Subscribe'],
            resources: [
              `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/\$aws/certificates/create/*`,
              `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/\$aws/provisioning-templates/${provisioningTemplate.templateName}/provision/*`,
            ],
          }),
        ],
      }).toJSON(),
      policyName: 'IoT-Policy-for-Claim',
      // tags: [],
    });
  }
}
