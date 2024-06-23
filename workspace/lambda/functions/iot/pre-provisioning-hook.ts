import 'source-map-support/register';

import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import type {
  Context,
  IoTPreProvisioningHookEvent,
  IoTPreProvisioningHookResult,
} from 'aws-lambda';
import { ZodError, z } from 'zod';

const logger = new Logger();
const tracer = new Tracer();

class ReqParamValidationError extends Error {}

const requestValidationParamsSchema = z.object({
  SerialNumber: z.string(),
  ValidationParam: z.string(),
});

export const handler = async (
  event: IoTPreProvisioningHookEvent,
  _context: Context,
): Promise<IoTPreProvisioningHookResult> => {
  tracer.getSegment();

  logger.debug('pre provisioning hook invoked.');
  logger.debug(JSON.stringify(event.parameters));

  try {
    const reqParams = requestValidationParamsSchema.parse(event.parameters);

    logger.debug(`recieved ValidationParam: ${reqParams.ValidationParam}`);

    // dummy validation sample
    if (reqParams.ValidationParam !== 'Genuin') {
      throw new ReqParamValidationError(); // TMP
    }

    const response = {
      allowProvisioning: true,
      parameterOverrides: {
        CreateDateTime: new Date().toISOString(),
      },
    } as const satisfies IoTPreProvisioningHookResult;

    return response;
  } catch (e) {
    const rejectResponse = {
      allowProvisioning: false,
      parameterOverrides: {},
    } as const satisfies IoTPreProvisioningHookResult;

    if (e instanceof ZodError) {
      logger.info('request parameters schema wrong');
      logger.info(e.toString());
    } else if (e instanceof ReqParamValidationError) {
      logger.info('request parameters contents wrong');
      logger.info(e.toString());
    } else {
      logger.error('Unexpected Error');
      logger.info(String(e));
    }

    return rejectResponse;
  }
};
