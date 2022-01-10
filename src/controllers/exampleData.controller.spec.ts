import { Chance } from "chance";

import { ExampleDataController } from "./exampleData.controller";
import { EnvironmentConfig } from "../config/env.config";
import { ValidationError } from "../errors/validation.error";
import { LoggerService } from "../services/common/logger.service";

const chance = new Chance();

describe("ExampleDataController", function () {
  const envConfig: Partial<EnvironmentConfig> = {
    logLevel: "info",
    region: process.env.AWS_REGION
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const mockSchemaValidator: any = {};
  const mockExampleDataService: any = {};
  let exampleDataController;
  const fakeResolvedPromise = (): Promise<any> => Promise.resolve({ result: ["some data"] });
  const fakeRejectedPromise = (): Promise<any> => Promise.reject(new Error("Error!"));

  const mockHeaders = { "Correlation-Object": JSON.stringify({ correlationId: "unit-test" }) };
  const mockEvent = {
    queryStringParameters: {} as any,
    pathParameters: {} as any,
    body: null,
    headers: mockHeaders
  };

  const fakeRequestData = {
    exampleNumber: chance.integer(),
    email: chance.email(),
    name: chance.string()
  };
  let mockPostEvent;
  const mockPostEventTemplate = {
    queryStringParameters: {},
    body: JSON.stringify(fakeRequestData),
    headers: mockHeaders
  };

  beforeEach(() => {
    mockPostEvent = Object.assign({}, mockPostEventTemplate); // Make a new copy of the event object, because it gets mutated
    mockSchemaValidator.validateModel = jasmine.createSpy("validateModel()").and.returnValue(fakeRequestData);
    mockExampleDataService.getAllItems = jasmine.createSpy("getAllItems()").and.callFake(fakeResolvedPromise);
    mockExampleDataService.getDataItem = jasmine.createSpy("getDataItem()").and.callFake(fakeResolvedPromise);
    mockExampleDataService.createDataItem = jasmine.createSpy("createDataItem()").and.callFake(fakeResolvedPromise);
    mockExampleDataService.updateDataItem = jasmine.createSpy("updateDataItem()").and.callFake(fakeResolvedPromise);
    exampleDataController = new ExampleDataController(loggerService, mockExampleDataService, mockSchemaValidator);
  });

  describe("getAllItems()", function () {
    it("returns a success response", async () => {
      const response = await exampleDataController.getAllItems(mockEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(0);
      expect(mockExampleDataService.getAllItems).toHaveBeenCalledTimes(1);
    });
  });

  describe("getExampleDataItem()", function () {
    it("returns a success response", async () => {
      const mockGetEvent = Object.assign({}, mockEvent);
      mockGetEvent.pathParameters.itemId = chance.guid();
      const response = await exampleDataController.getExampleDataItem(mockEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(0);
      expect(mockExampleDataService.getDataItem).toHaveBeenCalledTimes(1);
    });

    it("handles unexpected errors from the ExampleDataService", async () => {
      mockExampleDataService.getDataItem = jasmine.createSpy().and.callFake(fakeRejectedPromise);

      const response = await exampleDataController.getExampleDataItem(mockEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(500);
      expect(response.body).toBe('{"errorCode":500,"message":"An unexpected error occurred!","data":"Error!"}');
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(0);
      expect(mockExampleDataService.getDataItem).toHaveBeenCalledTimes(1);
    });
  });

  describe("postExampleDataItem()", () => {
    it("returns a success response", async () => {
      const response = await exampleDataController.postExampleDataItem(mockPostEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(201);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(response.body).toBeDefined();
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(1);
      expect(mockExampleDataService.createDataItem).toHaveBeenCalledTimes(1);
    });

    it("throws a ValidationError when the object doesn't pass validation", async () => {
      const mockValidationError = new ValidationError("An error occurred", [{ param: "test", issue: "malformed" }]);
      mockSchemaValidator.validateModel = jasmine.createSpy("validateModel()").and.callFake(() => {
        throw mockValidationError;
      });

      try {
        await exampleDataController.postExampleDataItem(mockPostEvent);
        fail("was supposed to throw an exception");
      } catch (error) {
        expect(error).toEqual(mockValidationError);
      }

      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(1);
      expect(mockExampleDataService.createDataItem).toHaveBeenCalledTimes(0);
    });
  });

  describe("patchExampleDataItem()", () => {
    it("returns a success response", async () => {
      const response = await exampleDataController.patchExampleDataItem(mockPostEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(response.body).toBeDefined();
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(1);
      expect(mockExampleDataService.updateDataItem).toHaveBeenCalledTimes(1);
    });

    it("handles unexpected errors from the ExampleDataService", async () => {
      mockExampleDataService.updateDataItem = jasmine.createSpy().and.callFake(fakeRejectedPromise);

      const response = await exampleDataController.patchExampleDataItem(mockPostEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(500);
      expect(response.body).toBe('{"errorCode":500,"message":"An unexpected error occurred!","data":"Error!"}');
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(1);
      expect(mockExampleDataService.updateDataItem).toHaveBeenCalledTimes(1);
    });

    it("throws a ValidationError when the object doesn't pass validation", async () => {
      mockSchemaValidator.validateModel = jasmine.createSpy("validateModel()").and.callFake(() => {
        throw new ValidationError("An error occurred", [{ param: "test", issue: "malformed" }]);
      });
      const response = await exampleDataController.patchExampleDataItem(mockPostEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(400);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(response.body).toBeDefined();
      expect(mockSchemaValidator.validateModel).toHaveBeenCalledTimes(1);
      expect(mockExampleDataService.updateDataItem).toHaveBeenCalledTimes(0);
    });
  });
});
