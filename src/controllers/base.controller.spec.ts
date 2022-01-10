import { BaseController } from "./base.controller";
import { BadRequestError } from "../errors/badRequest.error";
import { NotFoundError } from "../errors/notFound.error";
import { ProxyError } from "../errors/proxy.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { ValidationError } from "../errors/validation.error";
import { LoggerService } from "../services/common/logger.service";
import { EnvironmentConfig } from "../config/env.config";
import { /* APIGatewayProxyEvent, */ APIGatewayProxyResult } from "aws-lambda";

describe("BaseController", () => {
  const envConfig: Partial<EnvironmentConfig> = {
    logLevel: "info",
    region: process.env.AWS_REGION
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  let baseController: any;

  beforeEach(() => {
    baseController = new BaseController(loggerService);
  });

  describe("invoke()", () => {
    class MockController extends BaseController {
      constructor(loggerService: LoggerService) {
        super(loggerService);
      }

      async callBackMethod(/* event: APIGatewayProxyEvent */): Promise<APIGatewayProxyResult> {
        return this.createSuccessResponse({});
      }
    }

    const mockController = new MockController(loggerService);

    const mockEvent: any = {
      headers: {
        "Content-Type": "application/json",
        "Correlation-Object": JSON.stringify({
          correlationId: "unit-test"
        })
      }
    };

    beforeEach(() => {
      // set up callBackMethod to be a mock function
      const fakeResolvedPromise = (): Promise<any> => Promise.resolve({});
      mockController.callBackMethod = jasmine.createSpy("callBackMethod()").and.callFake(fakeResolvedPromise);
    });

    it("calls verifyCorrelationId", async () => {
      spyOn(mockController, "verifyCorrelationId").and.callThrough();

      await mockController.invoke(mockController.callBackMethod, mockEvent);
      expect(mockController.verifyCorrelationId).toHaveBeenCalled();
    });

    it("invokes the callback method on the controller", async () => {
      await mockController.invoke(mockController.callBackMethod, mockEvent);
      expect(mockController.callBackMethod).toHaveBeenCalledTimes(1);
    });

    it("handles errors from the controller callback method", async () => {
      // set up callBackMethod to throw Error
      mockController.callBackMethod = jasmine.createSpy("callBackMethod()").and.callFake(() => {
        throw new Error("Error!");
      });

      const result = await mockController.invoke(mockController.callBackMethod, mockEvent);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(500);
      expect(result.body).toBe('{"errorCode":500,"message":"An unexpected error occurred!","data":"Error!"}');
    });
  });

  describe("createResponseModel()", () => {
    it("returns a complete ResponseModel object", () => {
      const statusCode = 201;
      const bodyObject = { result: "Success!" };

      const result = baseController.createResponseModel(statusCode, bodyObject);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(statusCode);
      expect(result.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(result.body).toBe('{"result":"Success!"}');
    });
  });

  describe("createSuccessResponse()", () => {
    it("returns a ResponseModel object with success code", () => {
      const resultObject = "Success!";

      const result = baseController.createSuccessResponse(resultObject);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(200);
      expect(result.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(result.body).toBe('{"result":"Success!"}');
    });
  });

  describe("createErrorResponse()", () => {
    it("returns a ResponseModel object with standard error format", () => {
      const errorCode = 500;
      const message = "Error!";
      const data = { context: "error context" };

      const result = baseController.createErrorResponse(errorCode, message, data);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(errorCode);
      expect(result.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(result.body).toBe('{"errorCode":500,"message":"Error!","data":{"context":"error context"}}');
    });
  });

  describe("createUnexpectedErrorResponse()", () => {
    it("returns a ResponseModel object with standard server error code", () => {
      const expectedErrorCode = 500;
      const data = "error context";

      const result = baseController.createUnexpectedErrorResponse(data);

      expect(result).toBeDefined();
      expect(result.statusCode).toBe(expectedErrorCode);
      expect(result.body).toBe('{"errorCode":500,"message":"An unexpected error occurred!","data":"error context"}');
    });
  });

  describe("handleServiceErrors()", () => {
    it('returns a 400 error code for a "Bad Request" error', () => {
      const expectedErrorCode = 400;
      const error = new BadRequestError("BadRequestError");

      const result = baseController.handleServiceErrors(error);
      expect(result.statusCode).toBe(expectedErrorCode);
    });

    it('returns a 400 error code for a "Validation" error', () => {
      const expectedErrorCode = 400;
      const error = new ValidationError("ValidationError", {});

      const result = baseController.handleServiceErrors(error);
      expect(result.statusCode).toBe(expectedErrorCode);
    });

    it("returns a 401 error code for an 'Unauthorized' error", () => {
      const expectedErrorCode = 401;
      const error = new UnauthorizedError("UnauthorizedError");

      const result = baseController.handleServiceErrors(error);
      expect(result.statusCode).toBe(expectedErrorCode);
    });

    it("returns a 404 error code for a 'Not Found' error", () => {
      const expectedErrorCode = 404;
      const error = new NotFoundError("NotFoundError");

      const result = baseController.handleServiceErrors(error);
      expect(result.statusCode).toBe(expectedErrorCode);
    });

    it("returns a 504 error code for a 'Gateway Timeout' error", () => {
      const expectedErrorCode = 504;
      const error = new ProxyError("ProxyError");

      const result = baseController.handleServiceErrors(error);
      expect(result.statusCode).toBe(expectedErrorCode);
    });

    it("returns a 500 error code for an unexpected error", () => {
      const expectedErrorCode = 500;
      const error = new Error("unexpected error");

      const result = baseController.handleServiceErrors(error);
      expect(result.statusCode).toBe(expectedErrorCode);
    });
  });

  describe("verifyCorrelationId()", () => {
    let mockEvent;

    beforeEach(() => {
      spyOn(baseController, "verifyCorrelationId").and.callThrough();

      mockEvent = {
        body: JSON.stringify({
          c: "valueC",
          d: "valueD"
        }),
        headers: {
          "Content-Type": "application/json",
          "Correlation-Object": JSON.stringify({
            correlationId: "unit-test"
          })
        }
      };
    });

    it('recognizes a lowercase "correlation-object" header', () => {
      mockEvent.headers["correlation-object"] = mockEvent.headers["Correlation-Object"];
      delete mockEvent.headers["Correlation-Object"];

      expect(function () {
        baseController.verifyCorrelationId(mockEvent);
      }).not.toThrow();
    });

    it('recognizes an ALL CAPS "CORRELATION-OBJECT" header', () => {
      mockEvent.headers["CORRELATION-OBJECT"] = mockEvent.headers["Correlation-Object"];
      delete mockEvent.headers["Correlation-Object"];

      expect(function () {
        baseController.verifyCorrelationId(mockEvent);
      }).not.toThrow();
    });

    it('recognizes a mixed-case "CoRrElAtIoN-oBjEcT" header', () => {
      mockEvent.headers["CoRrElAtIoN-oBjEcT"] = mockEvent.headers["Correlation-Object"];
      delete mockEvent.headers["Correlation-Object"];

      expect(function () {
        baseController.verifyCorrelationId(mockEvent);
      }).not.toThrow();
    });

    it("throws an error when the headers section of the event is missing", () => {
      const expectedErrorMessage = "Event headers are missing or malformed.";
      delete mockEvent.headers;

      const testFunction = (): void => {
        baseController.verifyCorrelationId(mockEvent);
      };
      expect(testFunction).toThrowError(BadRequestError, expectedErrorMessage);
    });

    it("throws an error when the Correlation-Object is not present in the request headers", () => {
      const expectedErrorMessage = "A Correlation-Object header is required in the request.";
      delete mockEvent.headers["Correlation-Object"];

      const testFunction = (): void => {
        baseController.verifyCorrelationId(mockEvent);
      };
      expect(testFunction).toThrowError(BadRequestError, expectedErrorMessage);
    });

    it("throws an error when the Correlation-Object is malformed in the request headers", () => {
      const expectedErrorMessage = "A Correlation-Object header is required in the request.";
      mockEvent.headers["Correlation-Object"] = "not json";

      const testFunction = (): void => {
        baseController.verifyCorrelationId(mockEvent);
      };
      expect(testFunction).toThrowError(BadRequestError, expectedErrorMessage);
    });

    it("throws an error when the Correlation-Object does not have a correlationId property value", () => {
      const expectedErrorMessage = 'The field "correlationId" is missing in the request\'s Correlation-Object.';
      mockEvent.headers["Correlation-Object"] = '{"key":"value"}';

      const testFunction = (): void => {
        baseController.verifyCorrelationId(mockEvent);
      };
      expect(testFunction).toThrowError(BadRequestError, expectedErrorMessage);
    });
  });

  describe("verifyRequiredQueryStringParams()", () => {
    let mockEvent;

    beforeEach(() => {
      spyOn(baseController, "verifyRequiredQueryStringParams").and.callThrough();

      mockEvent = {
        queryStringParameters: {
          a: "valueA",
          b: "valueB"
        },
        body: JSON.stringify({
          c: "valueC",
          d: "valueD"
        }),
        headers: {
          "Content-Type": "application/json",
          "Correlation-Object": JSON.stringify({
            correlationId: "unit-test"
          })
        }
      };
    });

    it("confirms that all required params are present", () => {
      expect(function () {
        baseController.verifyRequiredQueryStringParams(mockEvent, ["a", "b"]);
      }).not.toThrow();
    });

    it("throws an error when the event is missing the queryStringParameters", () => {
      const expectedErrorMessage = 'Request event is malformed. The "queryStringParameters" object is missing.';
      delete mockEvent.queryStringParameters;

      const testFunction = (): void => {
        baseController.verifyRequiredQueryStringParams(mockEvent, ["a", "b"]);
      };
      expect(testFunction).toThrowError(BadRequestError, expectedErrorMessage);
    });

    it("throws an error when the query string is missing required params", () => {
      const expectedErrorMessage = 'The parameter "e" is required in the request\'s queryStringParameters.';

      const testFunction = (): void => {
        baseController.verifyRequiredQueryStringParams(mockEvent, ["a", "b", "e"]);
      };
      expect(testFunction).toThrowError(BadRequestError, expectedErrorMessage);
    });
  });
});
