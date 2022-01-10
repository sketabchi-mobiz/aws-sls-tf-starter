import { LoggerService } from "../services/common/logger.service";
import { ExampleExternalController } from "./exampleExternal.controller";
import { EnvironmentConfig } from "../config/env.config";

describe("ExampleExternalController", () => {
  const envConfig: Partial<EnvironmentConfig> = {
    logLevel: "info",
    region: process.env.AWS_REGION
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const mockExampleExternalService: any = {};
  let exampleExternalController;
  const fakeResolvedPromise = (): Promise<any> => Promise.resolve({ result: ["some data"] });

  const mockEvent = {
    queryStringParameters: {},
    body: null,
    headers: {
      "Correlation-Object": JSON.stringify({
        correlationId: "unit-test"
      })
    }
  };

  beforeEach(() => {
    mockExampleExternalService.pingWithSecret = jasmine.createSpy("pingWithSecret()").and.callFake(fakeResolvedPromise);
    exampleExternalController = new ExampleExternalController(loggerService, mockExampleExternalService);
  });

  describe("getPing()", () => {
    it("returns a success response", async () => {
      const response = await exampleExternalController.getPing(mockEvent);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      expect(mockExampleExternalService.pingWithSecret).toHaveBeenCalledTimes(1);
    });
  });
});
