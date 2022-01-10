import { inject, injectable } from "inversify";
import { LoggerService } from "../services/common/logger.service";
import { DynamoDB } from "aws-sdk";
import { BaseDynamoRepository } from "./baseDynamo.repository";
import { ExampleDynamoRepositoryInterface } from "./exampleDynamo.repository.interface";
import { NotFoundError } from "../errors/notFound.error";
import { ContainerKeys } from "../config/ioc.keys";
import { EnvironmentConfig } from "../config/env.config";
import { ExampleDataItemRecord } from "../models/exampleDataItemRecord.model";

@injectable()
export class ExampleDynamoRepository extends BaseDynamoRepository implements ExampleDynamoRepositoryInterface {
  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ContainerKeys.envConfig) envConfig: EnvironmentConfig,
    @inject(DynamoDB.DocumentClient) documentClient: DynamoDB.DocumentClient,
    @inject(DynamoDB) dynamodb: DynamoDB
  ) {
    super(logger, documentClient, dynamodb);

    this.init(envConfig.dbTableName, "pk", "sk");
  }

  /*
   * pingTable()
   * Gets metadata about the table.
   * Used for "pinging" the table to measure latency and verify connectivity and configuration.
   */
  async pingTable(): Promise<string> {
    this.logger.trace("pingTable() called", null, this.constructor.name);
    return this.describeTable();
  }

  /*
   * getAllRecords()
   * WARNING: Don't use this function on a large table. It is very slow.
   */
  async getAllRecords(): Promise<Array<ExampleDataItemRecord>> {
    this.logger.trace("getAllRecords() called", null, this.constructor.name);

    return (await this.scanWithFilters({})).map((it) => it as ExampleDataItemRecord);
  }

  /*
   * getRecord()
   * Get a single record from the database, based on the primary key (partition key + sort key)
   */
  async getRecord(partitionKeyValue: string, sortKeyValue: string): Promise<ExampleDataItemRecord> {
    this.logger.trace("getRecord() called", { partitionKeyValue, sortKeyValue }, this.constructor.name);

    // Get the database record with this primary key
    const record = await this.get(partitionKeyValue, sortKeyValue);
    if (!record) {
      throw new NotFoundError(`No item found with ID ${partitionKeyValue}`);
    }
    return record as ExampleDataItemRecord;
  }

  /*
   * deleteRecord()
   * Delete a single record from the database, based on the primary key (partition key + sort key)
   */
  async deleteRecord(partitionKeyValue: string, sortKeyValue: string): Promise<ExampleDataItemRecord> {
    this.logger.trace("deleteRecord() called", { partitionKeyValue, sortKeyValue }, this.constructor.name);

    return this.delete(partitionKeyValue, sortKeyValue) as Promise<ExampleDataItemRecord>;
  }

  /*
   * putRecord()
   * Create or replace a single record in the database, based on the primary key (partition key + sort key)
   * If the record already exists, it will be completely overwritten.
   * To do partial updates, use the update() function
   */
  async putRecord(record: ExampleDataItemRecord): Promise<ExampleDataItemRecord> {
    this.logger.trace("putRecord() called", { record }, this.constructor.name);

    return this.put(record) as Promise<ExampleDataItemRecord>;
  }

  /*
   * updatePartialRecord()
   * Update a partial record in the database.
   * Use this function to overwrite only the specific properties provided in the record input.
   * The record object must include the partition key and the sort key, or an error will be thrown.
   * Properties that are not provided are left unchanged on the record in the database.
   * Returns the updated record from the database.
   */
  async updatePartialRecord(record: ExampleDataItemRecord): Promise<ExampleDataItemRecord> {
    this.logger.trace("updatePartialRecord() called", { record }, this.constructor.name);
    return (await this.update(record)) as ExampleDataItemRecord;
  }
}
