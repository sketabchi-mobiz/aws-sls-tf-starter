import { LoggerService } from "./logger.service";
import { SecretService } from "./secret.service";
import { SecretsManager } from "aws-sdk";
import { EnvironmentConfig } from "../../config/env.config";

describe("SecretService", function () {
  const envConfig: Partial<EnvironmentConfig> = {
    region: "us-west-2",
    environmentName: "unit-test",
    releaseVersion: "0.0.1",
    logLevel: "info",
    exampleExternalDomain: "http://fakedomain.com",
    secretName: "a-fake-secret-name"
  };
  const fakePropertyName = "exampleExternalApiKey";
  const fakeSecretValue = "abcdefg12345";
  const fakeSerializedSecret = `{"${fakePropertyName}":"${fakeSecretValue}"}`;
  const fakeSmResponse = { SecretString: fakeSerializedSecret };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const mockSecretsManager = {} as SecretsManager;
  let secretService;

  beforeEach(() => {
    //  Our mock service for the Secrets Manager must return an object with a ".promise()" property,
    //  which will return a resolved promise using the fake response from Secrets Manager
    mockSecretsManager.getSecretValue = jasmine.createSpy("mockSecretsManager.getSecretValue").and.callFake(() => {
      return {
        promise: (): Promise<any> => {
          return Promise.resolve(fakeSmResponse);
        }
      };
    });
    secretService = new SecretService(loggerService, mockSecretsManager);
  });

  describe("getSecretValue()", function () {
    it("calls the Secrets Manager service with expected parameters and parses the result", async () => {
      // Make sure the retrievedSecret is cleared before starting this test
      secretService.retrievedSecret = {};

      const result = await secretService.getSecretValue(envConfig.secretName, fakePropertyName);

      expect(result).toEqual(fakeSecretValue);
      expect(mockSecretsManager.getSecretValue).toHaveBeenCalled();
    });

    it("loads the secret from in-memory cache when it has already been set", async () => {
      // Make sure the retrievedSecret key is set before starting this test
      secretService.retrievedSecrets[envConfig.secretName] = JSON.parse(fakeSerializedSecret);

      const result = await secretService.getSecretValue(envConfig.secretName, fakePropertyName);
      expect(result).toEqual(fakeSecretValue);
      expect(mockSecretsManager.getSecretValue).not.toHaveBeenCalled();
    });
  });
});
