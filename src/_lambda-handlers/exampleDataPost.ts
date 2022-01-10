import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { container } from "../config/ioc.container";
import { ExampleDataController } from "../controllers/exampleData.controller";

// During container warm-up, resolve the dependencies once
// so these can be reused for each invocation of the handler
const exampleDataController: ExampleDataController = container.get(ExampleDataController);

// This handler will be invoked each time the Lambda function is invoked
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  return exampleDataController.invoke(exampleDataController.postExampleDataItem, event);
};
