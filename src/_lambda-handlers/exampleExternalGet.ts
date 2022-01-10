import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { container } from "../config/ioc.container";
import { ExampleExternalController } from "../controllers/exampleExternal.controller";

// During container warm-up, resolve the dependencies once
// so these can be reused for each invocation of the handler
const exampleExternalController: ExampleExternalController = container.get(ExampleExternalController);

// This handler will be invoked each time the Lambda function is invoked
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return exampleExternalController.invoke(exampleExternalController.getPing, event);
};
