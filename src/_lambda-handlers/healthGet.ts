import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { container } from "../config/ioc.container";
import { HealthController } from "../controllers/health.controller";

// During container warm-up, resolve the dependencies once
// so these can be reused for each invocation of the handler
const healthController: HealthController = container.get(HealthController);

// This handler will be invoked each time the Lambda function is invoked
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return healthController.invoke(healthController.getHealth, event);
};
