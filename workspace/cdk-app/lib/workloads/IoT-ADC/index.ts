// import path from 'node:path';
// import { fileURLToPath } from 'node:url';

import { Aws, aws_iam as iam, aws_iot as iot, aws_s3 as s3 } from 'aws-cdk-lib';
import { Construct } from 'constructs';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

const iotPolicyVars = {
  thingNameVar: '${iot:Connection.Thing.ThingName}',
} as const;

export interface IoTSettingForADCProps {
  readonly stageName: string;
}

export class IoTSettingForADC extends Construct {
  readonly iotPolicyForDeviceDocument: iam.PolicyDocument;
  constructor(scope: Construct, id: string, props: IoTSettingForADCProps) {
    super(scope, id);

    const bucket = new s3.Bucket(this, 'ExampleBucket', {
      bucketName: `iot-adc-example-bucket-${Aws.ACCOUNT_ID}-${Aws.REGION}-${props.stageName}`,
    });

    const policyForS3Upload = new iam.Policy(this, 'example-policy-s3-upload', {
      policyName: 'example-policy-s3-upload',
      statements: [
        new iam.PolicyStatement({
          actions: ['s3:PutObject'],
          effect: iam.Effect.ALLOW,
          resources: [bucket.arnForObjects('*/upload/*')],
        }),
      ],
    });
    const policyForS3Download = new iam.Policy(
      this,
      'example-policy-s3-download',
      {
        policyName: 'example-policy-s3-download',
        statements: [
          new iam.PolicyStatement({
            actions: ['s3:GetObject'],
            effect: iam.Effect.ALLOW,
            resources: [bucket.arnForObjects('*/download/*')],
          }),
        ],
      },
    );

    const iamRoleForDevice = new iam.Role(this, 'Role for ADC', {
      assumedBy: new iam.ServicePrincipal('credentials.iot.amazonaws.com'),
      roleName: 'Role-for-ADC',
    });
    policyForS3Download.attachToRole(iamRoleForDevice);
    policyForS3Upload.attachToRole(iamRoleForDevice);

    const roleAlias = new iot.CfnRoleAlias(this, 'role-alias', {
      roleArn: iamRoleForDevice.roleArn,
      roleAlias: 'Example-RoleAlias',
      // tags: [
      //   { key: 'Cost', value: 'ADC' },
      // ],
    });

    this.iotPolicyForDeviceDocument = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iot:AssumeRoleWithCertificate'],
          resources: [roleAlias.attrRoleAliasArn],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iot:Connect'],
          resources: [
            `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:client/${iotPolicyVars.thingNameVar}`,
          ],
          conditions: {
            Bool: {
              'iot:Connection.Thing.IsAttached': ['true'],
            },
          },
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iot:Subscribe'],
          resources: [
            `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topicfilter/$aws/things/${iotPolicyVars.thingNameVar}/*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['iot:Publish', 'iot:Receive'],
          resources: [
            `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/things/${iotPolicyVars.thingNameVar}/*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'iot:DescribeJobExecution',
            'iot:GetPendingJobExecutions',
            'iot:GetThingShadow',
            'iot:StartNextPendingJobExecution',
            'iot:UpdateJobExecution',
            'iot:UpdateThingShadow',
          ],
          resources: [
            `arn:aws:iot:${Aws.REGION}:${Aws.ACCOUNT_ID}:topic/$aws/things/${iotPolicyVars.thingNameVar}`,
          ],
        }),
      ],
    });

    new iot.CfnPolicy(this, 'ExampleDeviceIoTPolicy', {
      policyDocument: this.iotPolicyForDeviceDocument.toJSON(),
      policyName: 'IoT-Policy-Device-using-ADC',
      // tags: [],
    });
  }
}
