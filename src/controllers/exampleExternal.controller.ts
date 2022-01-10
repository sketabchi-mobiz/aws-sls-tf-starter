import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BaseController } from "./base.controller";
import { inject, injectable } from "inversify";
import { LoggerService } from "../services/common/logger.service";
import { ExampleExternalService } from "../services/exampleExternal.service";

@injectable()
export class ExampleExternalController extends BaseController {
  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ExampleExternalService) private exampleExternalService: ExampleExternalService
  ) {
    super(logger);
  }

  async getPing(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.trace("getPing called", event, this.constructor.name);

    // Send the external request, using a secret retrieved from the Secrets Manager
    const result = await this.exampleExternalService.pingWithSecret();
    return this.createSuccessResponse(result);
  }
}
