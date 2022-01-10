import { inject, injectable } from "inversify";
import { LoggerService } from "./logger.service";
import { Credentials, TemporaryCredentials } from "aws-sdk";
import { ContainerKeys } from "../../config/ioc.keys";
import { EnvironmentConfig } from "../../config/env.config";

@injectable()
export class ApiRequestService {
  private clientInitializationPromise: any;
  private clientInitializationFailure: any;
  private apiGatewayClient: any;

  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(ContainerKeys.envConfig) private envConfig: EnvironmentConfig,
    apigClientFactory: any,
    private credentialsFactory: (stsParams: TemporaryCredentials.TemporaryCredentialsOptions) => TemporaryCredentials,
    apiBaseUrl: string,
    accountNum?: string,
    roleName?: string
  ) {
    const config = {
      invokeUrl: apiBaseUrl,
      accessKey: process.env.AWS_ACCESS_KEY_ID,
      secretKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
      region: process.env.AWS_REGION
    };

    if (accountNum && roleName) {
      // If the API endpoint is in a different AWS account,
      // then we need to use AWS STS to AssumeRole in the other account.
      this.clientInitializationPromise = this.assumeRole(accountNum, roleName, envConfig.serviceName).then(
        (credentials: Credentials) => {
          config.accessKey = credentials.accessKeyId;
          config.secretKey = credentials.secretAccessKey;
          config.sessionToken = credentials.sessionToken;

          this.apiGatewayClient = apigClientFactory.newClient(config);
        }
      );
    } else {
      this.apiGatewayClient = apigClientFactory.newClient(config);
      this.clientInitializationPromise = Promise.resolve();
    }
  }

  /**
   * Make a GET request
   * @param {object} templateParams template params, e.g. { userId: '1234' }
   * @param {string} pathTemplate path template, e.g. '/users/{userID}/profile'
   * @param {object} queryParams query params
   */
  async get(templateParams, pathTemplate, queryParams): Promise<any> {
    return this.invokeApi(templateParams, pathTemplate, "GET", queryParams, null);
  }

  /**
   * Make a POST request
   * @param {object} templateParams template params, e.g. { userId: '1234' }
   * @param {string} pathTemplate path template, e.g. '/users/{userID}/profile'
   * @param {any} body content to post
   */
  async post(templateParams, pathTemplate, body): Promise<any> {
    return this.invokeApi(templateParams, pathTemplate, "POST", {}, body);
  }

  /**
   * Make a PUT request
   * @param {object} templateParams template params, e.g. { userId: '1234' }
   * @param {string} pathTemplate path template, e.g. '/users/{userID}/profile'
   * @param {object} queryParams query params
   * @param {any} body content to post
   */
  async put(templateParams, pathTemplate, queryParams, body): Promise<any> {
    return this.invokeApi(templateParams, pathTemplate, "PUT", queryParams, body);
  }

  /**
   * Make a DELETE request
   * @param {object} templateParams template params, e.g. { userId: '1234' }
   * @param {string} pathTemplate path template, e.g. '/users/{userID}'
   * @param {object} queryParams query params
   * @param {any} body content
   */
  async delete(templateParams, pathTemplate, queryParams, body): Promise<any> {
    return this.invokeApi(templateParams, pathTemplate, "DELETE", queryParams, body);
  }

  async invokeApi(templateParams, pathTemplate, method, queryParams, body): Promise<any> {
    /*
        apiGatewayClient.invokeApi(params, pathTemplate, method, additionalParams, body)

        var additionalParams = {
            headers: {
                param0: '',
                param1: ''
            },
            queryParams: {
                param0: '',
                param1: ''
            }
        };

        For info regarding the parameters:
        https://www.npmjs.com/package/aws-api-gateway-client
    */
    const additionalParams = {
      headers: this.getHeaders(),
      queryParams: queryParams
    };

    // If the client failed to initialize, then reject the request immediately
    if (this.clientInitializationFailure) {
      return Promise.reject(this.clientInitializationFailure);
    }

    // Call this method if the client initialization is not yet complete
    // This will create a new Promise for the function being requested,
    // but it won't resolve that Promise until the client initialization has completed.
    return new Promise((resolve, reject) => {
      this.clientInitializationPromise
        .then(() => {
          // Here we resolve the new Promise so that all pending requests can happen in parallel,
          // rather than serialized by the same Promise chain.
          this.apiGatewayClient
            .invokeApi(templateParams, pathTemplate, method, additionalParams, body)
            .then((result) => {
              resolve(result.data);
            })
            .catch((error) => {
              const errorMessage = error.message;
              const responseBody = error.response?.daata;
              this.logger.error("Error response received", { errorMessage, responseBody });
              reject(error);
            });
        })
        .catch((error) => {
          // If the client initialization failed, then we need to reject the requested function
          // and store the error
          this.logger.error("ApiRequestService is in an errored state", { error });
          reject(error);
          this.clientInitializationFailure = error;
        });
    });
  }

  getHeaders(): Record<string, string> {
    return {
      "correlation-object": JSON.stringify(process["correlationObject"])
    };
  }

  async assumeRole(accountId: string, roleName: string, correlationId: string): Promise<TemporaryCredentials> {
    const stsParams: TemporaryCredentials.TemporaryCredentialsOptions = {
      DurationSeconds: 3600,
      ExternalId: "ManagementConsole",
      RoleArn: `arn:aws:iam::${accountId}:role/${roleName}`,
      RoleSessionName: `correlation-${correlationId}`
    };

    // AWS requires the RoleSessionName be a maximum of 64 characters
    stsParams.RoleSessionName = stsParams.RoleSessionName.substr(0, 64);

    return new Promise((resolve, reject) => {
      this.logger.info("assumeRole() called", { stsParams });

      // To use STS to AssumeRole on the target account, we create and 'refresh' temporary credentials.
      const awsTemporaryCredentials = this.credentialsFactory(stsParams);

      awsTemporaryCredentials.refresh((err) => {
        if (err) {
          this.logger.error("FAILED to assume STS Role with params: " + JSON.stringify(err), { stsParams });
          reject(err);
        } else {
          this.logger.info("SUCCEEDED in assuming STS Role!", {
            sessionName: stsParams.RoleSessionName
          });
          resolve(awsTemporaryCredentials);
        }
      });
    });
  }
}
