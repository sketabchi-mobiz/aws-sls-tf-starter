import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { BaseController } from "./base.controller";
import { inject, injectable } from "inversify";
import {
  CreateExampleDataItemRequest,
  CreateExampleDataItemRequestSchema,
  UpdateExampleDataItemRequest,
  UpdateExampleDataItemRequestSchema
} from "../models/exampleDataItem.schema";
import { LoggerService } from "../services/common/logger.service";
import { ExampleDataService } from "../services/exampleData.service";
import { SchemaValidator } from "../services/common/schemaValidator.service";

@injectable()
export class ExampleDataController extends BaseController {
  constructor(
    @inject(LoggerService) loggerService: LoggerService,
    @inject(ExampleDataService) private exampleDataService: ExampleDataService,
    @inject(SchemaValidator) private schemaValidator: SchemaValidator
  ) {
    super(loggerService);
  }

  async getAllItems(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.trace("getAllItems called", event.path, this.constructor.name);

    // NOTE: In a multi-tenant system, never execute a request that returns all records for all tenants.

    // Then request the data from the appropriate service
    const result = await this.exampleDataService.getAllItems();
    return this.createSuccessResponse(result);
  }

  async getExampleDataItem(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.trace("getDataItem called", null, this.constructor.name);

    try {
      this.verifyCorrelationId(event);

      // MOCKED: In a real application, get the tenantId from the user context
      const tenantId = "abcdef";

      const itemId = event.pathParameters.itemId;

      // Then request the data from the appropriate service
      const result = await this.exampleDataService.getDataItem(tenantId, itemId);
      return this.createSuccessResponse(result);
    } catch (error) {
      return this.handleServiceErrors(error);
    }
  }

  async postExampleDataItem(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.trace("postExampleDataItem called", null, this.constructor.name);

    // Schema validation of the data included in the POST request
    const dataItem = this.schemaValidator.validateModel<CreateExampleDataItemRequest>(
      event.body,
      CreateExampleDataItemRequestSchema
    );

    // MOCKED: In a real application, get the tenantId and userId from the user context
    const tenantId = "abcdef";
    const userId = "90210";

    const result = await this.exampleDataService.createDataItem(dataItem, tenantId, userId);

    return this.createResponseModel(this.HTTP_CODE_CREATED, { result });
  }

  async patchExampleDataItem(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
    this.logger.trace("patchExampleDataItem called", null, this.constructor.name);

    try {
      // Schema validation of the data included in the PATCH request
      const dataItem = this.schemaValidator.validateModel<UpdateExampleDataItemRequest>(
        event.body,
        UpdateExampleDataItemRequestSchema
      );

      this.verifyCorrelationId(event);

      // MOCKED: In a real application, get the tenantId and userId from the user context
      const tenantId = "abcdef";
      const userId = "90210";

      const result = await this.exampleDataService.updateDataItem(dataItem, tenantId, userId);

      return this.createSuccessResponse(result);
    } catch (error) {
      return this.handleServiceErrors(error);
    }
  }
}
