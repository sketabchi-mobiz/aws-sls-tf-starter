import { AxiosStatic } from "axios";
import { inject, injectable } from "inversify";
import { LoggerService } from "./common/logger.service";
import { SecretService } from "./common/secret.service";
import { ContainerKeys } from "../config/ioc.keys";
import { EnvironmentConfig } from "../config/env.config";

@injectable()
export class ExampleExternalService {
  private decryptedPropertyName = "exampleExternalApiKey";

  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(ContainerKeys.envConfig) private envConfig: EnvironmentConfig,
    @inject(ContainerKeys.requestService) private request: AxiosStatic,
    @inject(SecretService) private secretService: SecretService
  ) {}

  // createHeaders() returns the headers object to be sent with each exampleExternal request
  createHeaders(): Record<string, string> {
    this.logger.trace("createHeaders() called", null, this.constructor.name);

    return {
      "Accept-Language": "en-US",
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "SamServiceAccelerator/" + this.envConfig.releaseVersion
    };
  }

  // ping() makes a simple request to the external ExampleExternal integrated service
  // This is used to confirm connectivity to during health checks
  async ping(options): Promise<any> {
    this.logger.trace("ping() called", null, this.constructor.name);

    // This is where you can make some kind of request that confirms connectivity.

    // Setup the request to the external dependency
    let uri = this.envConfig.exampleExternalDomain;
    const headers = this.createHeaders();

    // Change something in the uri to force a failure (for api tests)
    if (options?.forceFailure) {
      uri = `broken${uri}`;
    }

    const response = await this.request.get(uri, headers);

    return {
      statusCode: response.status,
      body: response.data
    };
  }

  // pingWithSecret() first retrieves a decrypted secret value, like an API key, then
  // makes a simple request to the external ExampleExternal integrated service.
  // This demonstrates how to use in-app secrets management.
  async pingWithSecret(options?): Promise<any> {
    this.logger.trace("pingWithSecret() called", null, this.constructor.name);

    const secretKey = await this.secretService.getSecretValue(this.envConfig.secretName, this.decryptedPropertyName);

    // Setup the request to the external dependency
    let uri = this.envConfig.exampleExternalDomain;
    const headers = this.createHeaders();

    // Add the secret key to the request in whichever way the component requires
    headers["X-Api-Key"] = secretKey;

    // Change something in the uri to force a failure (for api tests)
    if (options?.forceFailure) {
      uri = `broken${uri}`;
    }

    const response = await this.request.get(uri, headers);

    return {
      statusCode: response.status,
      body: response.data
    };
  }
}
