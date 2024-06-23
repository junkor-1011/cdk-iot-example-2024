// import path from 'node:path';
// import url from 'node:url';
import { Stack, type StackProps, Tags } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import { FleetProvisioningSetting } from './workloads/FleetProvisioning';
import { IoTSettingForADC } from './workloads/IoT-ADC';

// const __filename = url.fileURLToPath(import.meta.url);
// const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export interface CdkAppStackProps extends StackProps {
  readonly stageName: string;
}

export class CdkAppStack extends Stack {
  constructor(scope: Construct, id: string, props: CdkAppStackProps) {
    super(scope, id, props);

    const iotSetting = new IoTSettingForADC(this, 'IoT ADC example', {
      stageName: props.stageName,
    });
    new FleetProvisioningSetting(this, 'FleetProvisioning example', {
      stageName: props.stageName,
      iotPolicyForDeviceDocument: iotSetting.iotPolicyForDeviceDocument,
    });

    console.log('DEBUG', props.stageName);
    Tags.of(this).add('STAGE', props.stageName);
  }
}
