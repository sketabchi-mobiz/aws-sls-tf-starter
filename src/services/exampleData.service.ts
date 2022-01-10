import { SNS } from "aws-sdk";
import { inject, injectable } from "inversify";
import { LoggerService } from "./common/logger.service";
import { EnvironmentConfig } from "../config/env.config";
import { ContainerKeys } from "../config/ioc.keys";
import { ExampleDataItemMapper } from "../mappers/exampleDataItem.mapper";
import {
  CreateExampleDataItemRequest,
  UpdateExampleDataItemRequest,
  ExampleDataItemResponse
} from "../models/exampleDataItem.schema";
import { ExampleSqsMessage } from "../models/exampleSqsMessage.model";
import { ExampleDynamoRepositoryInterface } from "../repositories/exampleDynamo.repository.interface";

@injectable()
export class ExampleDataService {
  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(ContainerKeys.envConfig) private envConfig: EnvironmentConfig,
    @inject(SNS) private sns: SNS,
    @inject(ContainerKeys.exampleDynamoRepositoryInterface)
    private exampleDynamoRepository: ExampleDynamoRepositoryInterface // The ExampleDynamoRepository must be an interface for unit tests and test coverage to work as intended.
  ) {}

  async getAllItems(): Promise<ExampleDataItemResponse[]> {
    this.logger.trace("getAllItems called", null, this.constructor.name);

    // Include business logic here
    // If you have a multi-tenancy system, make sure you never allow a user to scan the whole table without a query/filter on the partition key.

    // Get the list of items
    const resultList = await this.exampleDynamoRepository.getAllRecords();

    // Map the database objects into API Response objects
    return resultList.map((it) => ExampleDataItemMapper.convertToExampleDataItemResponse(it));
  }

  /*
   * getDataItem()
   * Get a single record from the database, based on the primary key (partition key + sort key)
   */
  async getDataItem(tenantId: string, itemId: string): Promise<ExampleDataItemResponse> {
    this.logger.trace("getDataItem() called", { tenantId, itemId }, this.constructor.name);

    const record = await this.exampleDynamoRepository.getRecord(`TENANT#${tenantId}`, itemId);

    return ExampleDataItemMapper.convertToExampleDataItemResponse(record);
  }

  /*
   * deleteDataItem()
   * Delete a single record from the database, based on the primary key (partition key + sort key)
   */
  async deleteDataItem(tenantId: string, itemId: string): Promise<ExampleDataItemResponse> {
    this.logger.trace("deleteDataItem() called", { tenantId, itemId }, this.constructor.name);

    const record = await this.exampleDynamoRepository.deleteRecord(`TENANT#${tenantId}`, itemId);

    return ExampleDataItemMapper.convertToExampleDataItemResponse(record);
  }

  /*
   * createDataItem()
   * Create a new data item and store it in the database.
   * This usually includes some business logic to map the request into the database model
   */
  async createDataItem(
    requestData: CreateExampleDataItemRequest,
    tenantId: string,
    userId: string
  ): Promise<ExampleDataItemResponse> {
    this.logger.trace("createDataItem called", { request: requestData, tenantId, userId }, this.constructor.name);

    const record = ExampleDataItemMapper.createNewDynamoRecord(requestData, tenantId, userId);

    // Put the record in the data store
    await this.exampleDynamoRepository.putRecord(record);

    // For asyncronous events: Send an event that a new item was created
    const msg: ExampleSqsMessage = {
      type: "NewDataItemCreated",
      tenantId: tenantId,
      itemId: record.itemId
    };
    const params = {
      TopicArn: this.envConfig.snsTopicExamplePublishTopicArn,
      Message: JSON.stringify(msg)
    };

    this.logger.info("Notifying SNS topic", params);

    // SETUP: Disabled to allow for local emulation of the accelerator
    // This next line will execute successfully after you have deployed your dev environment in AWS
    // await this.sns.publish(params).promise();

    return ExampleDataItemMapper.convertToExampleDataItemResponse(record);
  }

  /*
   * updateDataItem()
   * Update a partial data item in the database.
   * Use this function to overwrite only the specific properties provided in the record input.
   * The record object must include the partition key and the sort key, or an error will be thrown.
   * Properties that are not provided are left unchanged on the record in the database.
   * Returns the updated record from the database.
   */
  async updateDataItem(
    requestData: UpdateExampleDataItemRequest,
    tenantId: string,
    userId: string
  ): Promise<ExampleDataItemResponse> {
    this.logger.trace("updateDataItem() called", { request: requestData, tenantId, userId }, this.constructor.name);

    const record = ExampleDataItemMapper.convertToPartialDynamoRecord(requestData, tenantId, userId);

    // Overwrite the given attributes of the record in the data store
    const updatedRecord = await this.exampleDynamoRepository.updatePartialRecord(record);

    return ExampleDataItemMapper.convertToExampleDataItemResponse(updatedRecord);
  }

  async processSqsMessage(message: ExampleSqsMessage): Promise<any> {
    this.logger.debug("Processing message", { message }, this.constructor.name);
    // Do something cool
    return Promise.resolve({
      message: "Example SQS Message has been processed."
    });
  }
}
