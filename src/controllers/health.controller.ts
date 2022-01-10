import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BaseController } from "./base.controller";
import { inject, injectable } from "inversify";
import { HealthService } from "../services/health.service";
import { LoggerService } from "../services/common/logger.service";

@injectable()
export class HealthController extends BaseController {
  constructor(
    @inject(LoggerService) loggerService: LoggerService,
    @inject(HealthService) private healthService: HealthService
  ) {
    super(loggerService);
  }

  async getHealth(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.trace("getHealth called", null, this.constructor.name);

    const options = { forceExampleExternalFailure: false };

    // The health endpoint supports a query string parameter for 'forceExampleExternalFailure'
    if (event?.queryStringParameters?.["forceExampleExternalFailure"] !== undefined) {
      options.forceExampleExternalFailure = true;
    }

    const result = await this.healthService.getHealth(options);
    const response = this.createSuccessResponse(result);

    // Specific to the health endpoint, we set an error code if the health status is not 'healthy'
    if (result.status !== "healthy") {
      response.statusCode = this.HTTP_CODE_GATEWAY_TIMEOUT;
    }

    return response;
  }
}
