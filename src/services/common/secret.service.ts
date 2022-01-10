import { inject, injectable } from "inversify";
import { LoggerService } from "./logger.service";
import { SecretsManager } from "aws-sdk";
@injectable()
export class SecretService {
  private retrievedSecrets: any = {};

  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(SecretsManager) private secretsManager: SecretsManager
  ) {}

  async getSecretValue(secretName: string, propertyName: string): Promise<string> {
    this.logger.trace("getSecretValue() called", { secretName, propertyName }, this.constructor.name);

    // If the secret key has already been retrieved, then use the value from memory
    if (this.retrievedSecrets[secretName] !== undefined) {
      this.logger.debug("Secret retrieved from cache", null, this.constructor.name);
      return Promise.resolve(this.retrievedSecrets[secretName][propertyName]);
    }

    const params = {
      SecretId: secretName
    };
    this.logger.debug("Calling Secrets Manager service to retrieve secret", params, this.constructor.name);

    // Retrieve the decrypted secret key through the AWS Secrets Manager
    // This requires manual setup of a stored secret through the Secrets Manager
    // See the README.md file at the root of this repository for details.
    const response = await this.secretsManager.getSecretValue(params).promise();

    // Save the retrieved key for reuse, until the container gets recycled
    const serializedSecret = response.SecretString;
    const parsedSecret = JSON.parse(serializedSecret);

    // In-memory cache of the parsed secret for subsequent requests
    this.retrievedSecrets[secretName] = parsedSecret;

    // Add the secret values to the secret masks for the logger
    for (const key in parsedSecret) {
      this.logger.maskSecret(parsedSecret[key]);
    }

    return parsedSecret[propertyName];
  }
}
