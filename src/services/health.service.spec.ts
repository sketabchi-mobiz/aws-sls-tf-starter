import { LoggerService } from "./common/logger.service";
import { HealthService } from "./health.service";
import { EnvironmentConfig } from "../config/env.config";

describe("HealthService", () => {
  const mockExampleExternalService: any = {};
  const envConfig: Partial<EnvironmentConfig> = {
    environmentName: "unit-test",
    logLevel: "info",
    region: "us-west-2",
    releaseVersion: "0.0.1"
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  let healthService: any;
  const fakeResolvedPromise = (): Promise<any> => {
    return Promise.resolve();
  };
  const fakeRejectedPromise = (): Promise<any> => {
    return Promise.reject(new Error("Request Failed!"));
  };
  const fakeRejectedPromiseMessage = (): Promise<any> => {
    return Promise.reject("Error Message!");
  };

  beforeEach(() => {
    mockExampleExternalService.ping = jasmine.createSpy("mockExampleExternalService").and.callFake(fakeResolvedPromise);
    healthService = new HealthService(loggerService, envConfig as EnvironmentConfig, mockExampleExternalService);
  });

  describe("getHealth()", () => {
    it("returns healthy status with expected environment variables", async () => {
      const result = await healthService.getHealth({});

      const partialExpected = {
        status: "healthy",
        exampleExternalStatus: "healthy",
        version: "0.0.1",
        environmentName: "unit-test",
        logLevel: "info",
        region: "us-west-2",
        errors: []
      };
      expect(result).toEqual(jasmine.objectContaining(partialExpected));
      expect(mockExampleExternalService.ping).toHaveBeenCalledTimes(1);
    });

    it("returns healthy status when options parameter is undefined", async () => {
      const result = await healthService.getHealth();

      const partialExpected = {
        status: "healthy",
        exampleExternalStatus: "healthy",
        version: "0.0.1",
        environmentName: "unit-test",
        logLevel: "info",
        region: "us-west-2",
        errors: []
      };
      expect(result).toEqual(jasmine.objectContaining(partialExpected));
      expect(mockExampleExternalService.ping).toHaveBeenCalledTimes(1);
    });

    it("returns error status when ExampleExternal connection fails", async () => {
      // Force the ExampleExternal service to fail
      mockExampleExternalService.ping.and.callFake(fakeRejectedPromise);

      const result = await healthService.getHealth({});

      const partialExpected = {
        status: "error",
        exampleExternalStatus: "error",
        version: "0.0.1",
        environmentName: "unit-test",
        logLevel: "info",
        region: "us-west-2",
        errors: ["ExampleExternal Status: Request Failed!"]
      };
      expect(result).toEqual(jasmine.objectContaining(partialExpected));
      expect(mockExampleExternalService.ping).toHaveBeenCalledTimes(1);
    });

    it("returns error status when ExampleExternal connection fails with a message instead of an Error", async () => {
      // Force the ExampleExternal service to fail
      mockExampleExternalService.ping.and.callFake(fakeRejectedPromiseMessage);

      const result = await healthService.getHealth({});

      const partialExpected = {
        status: "error",
        exampleExternalStatus: "error",
        version: "0.0.1",
        environmentName: "unit-test",
        logLevel: "info",
        region: "us-west-2",
        errors: ["ExampleExternal Status: Error Message!"]
      };
      expect(result).toEqual(jasmine.objectContaining(partialExpected));
      expect(mockExampleExternalService.ping).toHaveBeenCalledTimes(1);
    });

    it("passes on the forceFailure flag when the forceExampleExternalFailure option is true", async () => {
      await healthService.getHealth({ forceExampleExternalFailure: true });

      expect(mockExampleExternalService.ping).toHaveBeenCalledTimes(1);
      expect(mockExampleExternalService.ping).toHaveBeenCalledWith({ forceFailure: true });
    });
  });
});
