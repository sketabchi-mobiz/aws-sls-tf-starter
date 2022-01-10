import { Chance } from "chance";

import { ExampleDataService } from "./exampleData.service";
import { LoggerService } from "./common/logger.service";
import { EnvironmentConfig } from "../config/env.config";
import { ExampleDataItemRecord } from "../models/exampleDataItemRecord.model";
import { CreateExampleDataItemRequest, UpdateExampleDataItemRequest } from "../models/exampleDataItem.schema";
import { ExampleSqsMessage } from "../models/exampleSqsMessage.model";

const chance = new Chance();

describe("ExampleDataService", () => {
  const isoStringRegex = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
  const cuidRegex = /^[0-9a-z]{25}/;
  const mockExampleDynamoRepository: any = {};
  const envConfig: Partial<EnvironmentConfig> = {
    environmentName: "unit-test",
    logLevel: "info",
    region: "us-west-2",
    releaseVersion: "0.0.1",
    snsTopicExamplePublishTopicArn: "fake-sns-topic"
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const tenantId = chance.guid();
  const userId = chance.guid();
  const itemId = chance.guid();
  const now = new Date().toISOString();
  const dbResults = [
    {
      pk: `TENANT#${tenantId}`,
      sk: itemId,
      itemId: itemId,
      name: chance.string(),
      email: chance.email(),
      exampleNumber: chance.integer(),
      createdTimestamp: now,
      updatedTimestamp: now,
      createdBy: userId,
      updatedBy: userId
    }
  ] as ExampleDataItemRecord[];
  const expectedServiceResultItem = {
    id: dbResults[0].sk,
    name: dbResults[0].name,
    email: dbResults[0].email,
    exampleNumber: dbResults[0].exampleNumber,
    address: undefined,
    createdTimestamp: now,
    updatedTimestamp: now,
    createdBy: userId,
    updatedBy: userId
  };
  const fakeListResolvedPromise = (): Promise<any> => Promise.resolve(dbResults);
  const fakeResolvedPromise = (): Promise<any> => Promise.resolve(dbResults[0]);
  const mockSns: any = {};
  const mockSnsMessage: ExampleSqsMessage = {
    type: "NewDataItemCreated",
    tenantId: tenantId,
    itemId: dbResults[0].sk
  };

  let exampleDataService: ExampleDataService;

  beforeEach(() => {
    mockExampleDynamoRepository.getAllRecords = jasmine
      .createSpy("getAllRecords")
      .and.callFake(fakeListResolvedPromise);
    mockExampleDynamoRepository.getRecord = jasmine.createSpy("getRecord").and.callFake(fakeResolvedPromise);
    mockExampleDynamoRepository.deleteRecord = jasmine.createSpy("deleteRecord").and.callFake(fakeResolvedPromise);
    mockExampleDynamoRepository.putRecord = jasmine
      .createSpy("putRecord")
      .and.callFake((input) => Promise.resolve(input));
    mockExampleDynamoRepository.updatePartialRecord = jasmine
      .createSpy("updatePartialRecord")
      .and.callFake((input) => Promise.resolve(input));
    mockSns.publish = jasmine.createSpy("publish").and.returnValue({ promise: () => Promise.resolve() });
    exampleDataService = new ExampleDataService(
      loggerService,
      envConfig as EnvironmentConfig,
      mockSns,
      mockExampleDynamoRepository
    );
  });

  describe("getAllItems()", () => {
    it("calls the repository function and maps the results", async () => {
      const expectedResultList = [expectedServiceResultItem];
      const result = await exampleDataService.getAllItems();

      expect(result).toEqual(expectedResultList);
      expect(mockExampleDynamoRepository.getAllRecords).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDataItem()", () => {
    it("calls the repository function and maps the result", async () => {
      const result = await exampleDataService.getDataItem(tenantId, itemId);

      expect(result).toEqual(expectedServiceResultItem);
      expect(mockExampleDynamoRepository.getRecord).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteDataItem()", () => {
    it("calls the repository function", async () => {
      const result = await exampleDataService.deleteDataItem(tenantId, itemId);

      expect(result).toEqual(expectedServiceResultItem);
      expect(mockExampleDynamoRepository.deleteRecord).toHaveBeenCalledTimes(1);
    });
  });

  describe("createDataItem()", () => {
    it("creates a new item", async () => {
      const requestData: CreateExampleDataItemRequest = {
        name: chance.string()
      };

      const expectedServiceResult = jasmine.objectContaining({
        id: jasmine.stringMatching(cuidRegex),
        name: requestData.name,
        createdTimestamp: jasmine.stringMatching(isoStringRegex),
        updatedTimestamp: jasmine.stringMatching(isoStringRegex),
        createdBy: userId,
        updatedBy: userId
      });

      const result = await exampleDataService.createDataItem(requestData, tenantId, userId);

      expect(result).toEqual(expectedServiceResult);

      // SETUP: Commented out until after the dev environment is deployed,
      // when the SNS Topic is actually created
      // expect(mockSns.publish).toHaveBeenCalledWith({
      //   TopicArn: envConfig.snsTopicExamplePublishTopicArn,
      //   Message: JSON.stringify()
      // };);

      expect(mockExampleDynamoRepository.putRecord).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateDataItem()", () => {
    it("partially updates an existing item", async () => {
      const requestData: UpdateExampleDataItemRequest = {
        name: chance.string()
      };

      const expectedServiceResult = jasmine.objectContaining({
        name: requestData.name
      });

      const result = await exampleDataService.updateDataItem(requestData, tenantId, userId);

      expect(result).toEqual(expectedServiceResult);
      expect(mockExampleDynamoRepository.updatePartialRecord).toHaveBeenCalledTimes(1);
    });
  });

  describe("processSqsMessage()", function () {
    it("processes the incoming message", async () => {
      const result = await exampleDataService.processSqsMessage(mockSnsMessage);

      expect(result.message).toEqual("Example SQS Message has been processed.");
    });
  });
});
