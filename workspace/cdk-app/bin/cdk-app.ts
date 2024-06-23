#!/usr/bin/env node
import process from 'node:process';

import { App, Aspects } from 'aws-cdk-lib';
import 'source-map-support/register';
import {
  AwsSolutionsChecks,
  HIPAASecurityChecks,
  NIST80053R5Checks,
  PCIDSS321Checks,
} from 'cdk-nag';
import { CdkAppStack } from '../lib/cdk-app-stack';

const getStageName = (): string => {
  const value = process.env.STAGE_NAME;

  if (value == null) {
    throw new Error('set environment variable: STAGE_NAME');
  }

  return value;
};
const stageName = getStageName();

const app = new App();
new CdkAppStack(app, `cdk-iot-example-${stageName}`, {
  stageName,
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */
  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },
  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

const checkAspects = process.env.CHECK_ASPECTS === 'true';

if (checkAspects) {
  Aspects.of(app).add(new AwsSolutionsChecks());
  Aspects.of(app).add(new NIST80053R5Checks());
  Aspects.of(app).add(new PCIDSS321Checks());
  Aspects.of(app).add(new HIPAASecurityChecks());
}
