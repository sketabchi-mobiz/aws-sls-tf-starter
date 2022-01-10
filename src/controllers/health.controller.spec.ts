import { HealthController } from "./health.controller";
import { LoggerService } from "../services/common/logger.service";
import { EnvironmentConfig } from "../config/env.config";

describe("HealthController", () => {
  const envConfig: Partial<EnvironmentConfig> = {
    logLevel: "info",
    region: process.env.AWS_REGION
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const mockHealthService: any = {};
  let healthController: any;
  const fakeResolvedPromise = (): Promise<any> => Promise.resolve({ status: "healthy" });
  const fakeResolvedErrorPromise = (): Promise<any> => Promise.resolve({ status: "error" });

  beforeEach(() => {
    mockHealthService.getHealth = jasmine.createSpy("getHealth()").and.callFake(fakeResolvedPromise);
    healthController = new HealthController(loggerService, mockHealthService);
  });

  describe("getHealth()", () => {
    it("returns a success response", async () => {
      const response = await healthController.getHealth({});

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(200);
      expect(response.headers["Access-Control-Allow-Origin"]).toBeDefined();
      // TODO: Body expectation needs to be updated
      // expect(response.body).toBe('{"result":{"status":"healthy"}}');
      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(1);
    });

    it("passes on the forceExampleExternalFailure flag when it is present in the event's querystring parameters", async () => {
      const event = {
        queryStringParameters: {
          forceExampleExternalFailure: true
        }
      };
      mockHealthService.getHealth.and.callFake(fakeResolvedErrorPromise);

      const response = await healthController.getHealth(event);

      expect(response).toBeDefined();
      expect(response.statusCode).toBe(504);
      expect(response.body).toBe('{"result":{"status":"error"}}');
      expect(mockHealthService.getHealth).toHaveBeenCalledTimes(1);
      expect(mockHealthService.getHealth).toHaveBeenCalledWith({
        forceExampleExternalFailure: true
      });
    });
  });
});
