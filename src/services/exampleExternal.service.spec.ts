import { AxiosStatic } from "axios";
import { LoggerService } from "./common/logger.service";
import { SecretService } from "./common/secret.service";
import { ExampleExternalService } from "./exampleExternal.service";
import { EnvironmentConfig } from "../config/env.config";

describe("ExampleExternalService", function () {
  const mockRequestService = {} as AxiosStatic;
  const envConfig: Partial<EnvironmentConfig> = {
    region: "us-west-2",
    environmentName: "unit-test",
    releaseVersion: "0.0.1",
    logLevel: "info",
    exampleExternalDomain: "http://fakedomain.com",
    secretName: "a-fake-secret-name",
    snsTopicExamplePublishTopicArn: "fake-sns-topic"
  };
  const fakeSecretValue = "abcdefg12345";
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const mockSecretService = {} as SecretService;
  let exampleExternalService;
  const expectedSuccessResult = { status: 200, data: "Success" };
  const fakeResolvedPromise = (): Promise<any> => {
    return Promise.resolve(expectedSuccessResult);
  };
  const expectedResult = { statusCode: 200, body: expectedSuccessResult.data };

  beforeEach(() => {
    mockSecretService.getSecretValue = jasmine
      .createSpy("mockSecretService.getSecretValue")
      .and.returnValue(Promise.resolve(fakeSecretValue));
    mockRequestService.get = jasmine.createSpy("get").and.callFake(fakeResolvedPromise);
    exampleExternalService = new ExampleExternalService(
      loggerService,
      envConfig as EnvironmentConfig,
      mockRequestService,
      mockSecretService
    );
  });

  describe("ping()", function () {
    it("calls the request service with expected options", async () => {
      const result = await exampleExternalService.ping();

      expect(result).toEqual(expectedResult);
      expect(mockRequestService.get).toHaveBeenCalled();
    });

    it("calls the request service without the uri when forceFailure is true", async () => {
      await exampleExternalService.ping({ forceFailure: true });

      // Expect that the uri has been broken
      const expectedUri = jasmine.stringMatching("broken");

      expect(mockRequestService.get).toHaveBeenCalledWith(expectedUri, jasmine.anything());
    });
  });

  describe("pingWithSecret()", function () {
    it("calls the request service with expected options and decrypted secret", async () => {
      const result = await exampleExternalService.pingWithSecret();

      const expectedHeaders = jasmine.objectContaining({ "X-Api-Key": fakeSecretValue });
      expect(result).toEqual(expectedResult);
      expect(mockRequestService.get).toHaveBeenCalledWith(jasmine.anything(), expectedHeaders);
      expect(mockSecretService.getSecretValue).toHaveBeenCalled();
    });

    it("calls the request service without the uri when forceFailure is true", async () => {
      await exampleExternalService.pingWithSecret({ forceFailure: true });

      // Expect that the uri has been broken
      const expectedUri = jasmine.stringMatching("broken");

      expect(mockRequestService.get).toHaveBeenCalledWith(expectedUri, jasmine.anything());
    });
  });
});
