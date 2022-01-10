import { LoggerService } from "./logger.service";
import { ApiRequestService } from "./apiRequest.service";
import { EnvironmentConfig } from "../../config/env.config";

describe("service: ApiRequestService", () => {
  const envConfig: Partial<EnvironmentConfig> = {
    environmentName: "unit-test",
    logLevel: "info",
    secretName: "a-fake-secret-name",
    region: "us-west-2",
    releaseVersion: "0.0.1"
  };
  const loggerService = new LoggerService(envConfig as EnvironmentConfig);
  const correlationObject = { correlationId: "unit-test" };
  const expectedHeaders = {
    "correlation-object": JSON.stringify(correlationObject)
  };

  const fakeErrorMessage = "Failure Test";
  const fakeSuccessResponse = { data: "someData" };
  const apigClientMock = {} as any;

  let savedApigConfig;
  const apigClientFactory = {
    newClient: (config): any => {
      savedApigConfig = config;
      return apigClientMock;
    }
  };

  const accessKeyId = "00000";
  const secretAccessKey = "99999";
  const sessionToken = "56789";

  let credentialsFactory;
  let apiRequestService;
  let roleBasedApiRequestService;

  beforeEach(() => {
    process["correlationObject"] = correlationObject;
    apigClientMock.invokeApi = (): Promise<any> => {
      return Promise.resolve(fakeSuccessResponse);
    };
    spyOn(apigClientMock, "invokeApi").and.callThrough();

    const mockCredentials: any = {
      refresh: (callback) => {
        mockCredentials.accessKeyId = accessKeyId;
        mockCredentials.secretAccessKey = secretAccessKey;
        mockCredentials.sessionToken = sessionToken;
        callback(null);
      }
    };

    credentialsFactory = jasmine.createSpy("credentials Factory", () => mockCredentials).and.callThrough();

    apiRequestService = new ApiRequestService(
      loggerService,
      envConfig as EnvironmentConfig,
      apigClientFactory,
      credentialsFactory,
      "https://fake.endpoint.com"
    );
  });

  describe("get()", () => {
    it("makes a successful GET request", async () => {
      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";
      const queryParams = {};

      const additionalParams = {
        headers: expectedHeaders,
        queryParams: queryParams
      };

      const response = await apiRequestService.get(pathTemplateParameters, pathTemplate, queryParams);

      expect(apigClientMock.invokeApi).toHaveBeenCalledWith(
        pathTemplateParameters,
        pathTemplate,
        "GET",
        additionalParams,
        null
      );
      expect(response).toBe(fakeSuccessResponse.data);
    });
  });

  describe("post()", () => {
    it("makes a successful POST request", async () => {
      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";

      const additionalParams = {
        headers: expectedHeaders,
        queryParams: {}
      };

      const body = {
        id: "someId"
      };

      const response = await apiRequestService.post(pathTemplateParameters, pathTemplate, body);

      expect(apigClientMock.invokeApi).toHaveBeenCalledWith(
        pathTemplateParameters,
        pathTemplate,
        "POST",
        additionalParams,
        body
      );
      expect(response).toBe(fakeSuccessResponse.data);
    });
  });

  describe("put()", () => {
    it("makes a successful PUT request", async () => {
      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";

      const additionalParams = {
        headers: expectedHeaders,
        queryParams: {}
      };

      const body = {
        id: "someId"
      };

      const response = await apiRequestService.put(pathTemplateParameters, pathTemplate, {}, body);

      expect(apigClientMock.invokeApi).toHaveBeenCalledWith(
        pathTemplateParameters,
        pathTemplate,
        "PUT",
        additionalParams,
        body
      );
      expect(response).toBe(fakeSuccessResponse.data);
    });
  });

  describe("delete()", () => {
    it("makes a successful DELETE request", async () => {
      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";

      const additionalParams = {
        headers: expectedHeaders,
        queryParams: {}
      };

      const response = await apiRequestService.delete(
        pathTemplateParameters,
        pathTemplate,
        additionalParams.queryParams,
        null
      );

      expect(apigClientMock.invokeApi).toHaveBeenCalledWith(
        pathTemplateParameters,
        pathTemplate,
        "DELETE",
        additionalParams,
        null
      );
      expect(response).toBe(fakeSuccessResponse.data);
    });
  });

  describe("invokeApi()", () => {
    beforeEach(() => {
      const mockCredentials: any = {
        refresh: (callback) => {
          mockCredentials.accessKeyId = accessKeyId;
          mockCredentials.secretAccessKey = secretAccessKey;
          mockCredentials.sessionToken = sessionToken;
          callback(null);
        }
      };

      credentialsFactory = jasmine.createSpy("credentials Factory", () => mockCredentials).and.callThrough();

      // Create the ApiRequestService with the accountNum and roleName parameters
      roleBasedApiRequestService = new ApiRequestService(
        loggerService,
        envConfig as EnvironmentConfig,
        apigClientFactory,
        credentialsFactory,
        "https://fake.endpoint.com",
        "12345",
        "sampleRole"
      );
    });

    it("calls the credentials factory when constructed with accountNum and roleName", () => {
      expect(credentialsFactory).toHaveBeenCalled();
    });

    it("executes the API request when credentials are successfully retrieved", async () => {
      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";
      const queryParams = {};

      const additionalParams = {
        headers: expectedHeaders,
        queryParams: queryParams
      };

      const response = await roleBasedApiRequestService.invokeApi(
        pathTemplateParameters,
        pathTemplate,
        "GET",
        queryParams,
        null
      );

      expect(apigClientMock.invokeApi).toHaveBeenCalledWith(
        pathTemplateParameters,
        pathTemplate,
        "GET",
        additionalParams,
        null
      );

      expect(savedApigConfig.accessKey).toBe(accessKeyId);
      expect(savedApigConfig.secretKey).toBe(secretAccessKey);
      expect(savedApigConfig.sessionToken).toBe(sessionToken);
      expect(response).toBe(fakeSuccessResponse.data);
    });

    it("rejects the promise when the client was not able to be initialized", (done) => {
      roleBasedApiRequestService.clientInitializationPromise = Promise.reject(fakeErrorMessage);

      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";
      const queryParams = {};

      roleBasedApiRequestService
        .invokeApi(pathTemplateParameters, pathTemplate, "GET", queryParams, null)
        .then(() => done.fail("Should not have succeeded."))
        .catch((error) => {
          expect(apigClientMock.invokeApi).not.toHaveBeenCalled();
          expect(error).toBe(fakeErrorMessage);
          done();
        });
    });

    it("handles errors by returning the error result", (done) => {
      // Force an error response
      apigClientMock.invokeApi.and.callFake(() => {
        return Promise.reject(fakeErrorMessage);
      });

      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";
      const queryParams = {};

      const additionalParams = {
        headers: expectedHeaders,
        queryParams: queryParams
      };

      roleBasedApiRequestService
        .invokeApi(pathTemplateParameters, pathTemplate, "GET", queryParams, null)
        .then(() => done.fail("Should not have succeeded."))
        .catch((error) => {
          expect(apigClientMock.invokeApi).toHaveBeenCalledWith(
            pathTemplateParameters,
            pathTemplate,
            "GET",
            additionalParams,
            null
          );
          expect(error).toBe(fakeErrorMessage);
          done();
        });
    });

    it("returns an error when STS fails to assume role", (done) => {
      // Force an error response
      const mockCredentials = {
        refresh: (callback): void => {
          callback(fakeErrorMessage);
        }
      };

      credentialsFactory = jasmine.createSpy("credentials Factory", () => mockCredentials).and.callThrough();

      // Create the ApiRequestService with the accountNum and roleName parameters
      const erroredApiRequestService = new ApiRequestService(
        loggerService,
        envConfig as EnvironmentConfig,
        apigClientFactory,
        credentialsFactory,
        "https://fake.endpoint.com",
        "12345",
        "sampleRole"
      );

      const pathTemplateParameters = {
        param1: "param1_value"
      };

      const pathTemplate = "/resource/{param1}";
      const queryParams = {};

      erroredApiRequestService
        .invokeApi(pathTemplateParameters, pathTemplate, "GET", queryParams, null)
        .then(() => done.fail("Should not have succeeded."))
        .catch((error) => {
          expect(apigClientMock.invokeApi).not.toHaveBeenCalled();
          expect(error).toBe(fakeErrorMessage);

          // A second request on the uninitialized service will also fail quickly
          erroredApiRequestService
            .invokeApi(pathTemplateParameters, pathTemplate, "GET", queryParams, null)
            .then(() => done.fail("Should not have succeeded."))
            .catch((error) => {
              expect(error).toBe(fakeErrorMessage);

              done();
            });
        });
    });
  });
});
