// Required to be first import
import "reflect-metadata";
import axios from "axios";

import { DynamoDB, Endpoint, SecretsManager, SNS, TemporaryCredentials } from "aws-sdk";
import { Container } from "inversify";
import { ContainerKeys } from "./ioc.keys";
import { HealthController } from "../controllers/health.controller";
import { ApiRequestService } from "../services/common/apiRequest.service";
import { ExampleExternalService } from "../services/exampleExternal.service";
import { HealthService } from "../services/health.service";
import { LoggerService } from "../services/common/logger.service";
import { ExampleDataService } from "../services/exampleData.service";
import { SecretService } from "../services/common/secret.service";
import { SchemaValidator } from "../services/common/schemaValidator.service";
import { ExampleDataController } from "../controllers/exampleData.controller";
import { ExampleExternalController } from "../controllers/exampleExternal.controller";
import { ExampleDynamoRepository } from "../repositories/exampleDynamo.repository";
import { ExampleDynamoRepositoryInterface } from "../repositories/exampleDynamo.repository.interface";
import { EnvironmentConfig } from "./env.config";

const apigClientFactory = require("aws-api-gateway-client"); // eslint-disable-line @typescript-eslint/no-var-requires

// Create the IOC Container
const container = new Container();

try {
  // Support for dynamodb-local when running locally
  let dynamodbOptions = null;
  let domain = process.env.domain;

  // AWS_SAM_LOCAL is set only when running via `sam local`
  if (process.env.AWS_SAM_LOCAL === "true") {
    // eslint-disable-next-line no-console
    console.log("Local environment detected.");

    // Configure dynamodb-local
    dynamodbOptions = { endpoint: new Endpoint("http://dynamodb:8000") };

    // Configure the domain for local execution -- this usually connects to the "dev" environment
    domain = process.env.localDomain;
    console.log(`Local domain: "${domain}"`);
  }

  // Setup the envConfig with values from process.env
  // These must each be set as Lambda Environment Variables in the microservice.sam.yml file
  const envConfig: EnvironmentConfig = Object.freeze({
    region: process.env.AWS_REGION,
    serviceName: process.env.serviceName,
    environmentName: process.env.environmentName,
    releaseVersion: process.env.releaseVersion,
    logLevel: process.env.logLevel,
    domain: domain,
    exampleExternalDomain: process.env.exampleExternalDomain,
    secretName: process.env.secretName,
    dbTableName: process.env.dbTableName,
    snsTopicExamplePublishTopicArn: process.env.snsTopicExamplePublishTopicArn
  });

  container.bind(ContainerKeys.envConfig).toConstantValue(envConfig);

  // Bindings for common services from node modules
  container.bind(DynamoDB).toConstantValue(new DynamoDB(dynamodbOptions));
  container.bind(DynamoDB.DocumentClient).toConstantValue(new DynamoDB.DocumentClient(dynamodbOptions));
  container.bind(SecretsManager).toConstantValue(new SecretsManager());
  container.bind(SNS).toConstantValue(new SNS());
  container.bind(ContainerKeys.requestService).toConstantValue(axios);

  container.bind<ExampleExternalController>(ExampleExternalController).to(ExampleExternalController);
  container.bind<ExampleDataController>(ExampleDataController).to(ExampleDataController);
  container.bind<HealthController>(HealthController).to(HealthController);

  container.bind<ExampleExternalService>(ExampleExternalService).to(ExampleExternalService);
  container.bind<ExampleDataService>(ExampleDataService).to(ExampleDataService);
  container.bind<HealthService>(HealthService).to(HealthService);
  container.bind<LoggerService>(LoggerService).to(LoggerService);
  container.bind<SchemaValidator>(SchemaValidator).to(SchemaValidator);
  container.bind<SecretService>(SecretService).to(SecretService);

  container
    .bind<ExampleDynamoRepositoryInterface>(ContainerKeys.exampleDynamoRepositoryInterface)
    .to(ExampleDynamoRepository);

  // Declare Factories
  const credentialsFactory = (stsParams: TemporaryCredentials.TemporaryCredentialsOptions): TemporaryCredentials => {
    return new TemporaryCredentials(stsParams);
  };

  container.bind(ApiRequestService).toFactory(() => {
    return (apiBaseUrl, accountNum, roleName): ApiRequestService => {
      return new ApiRequestService(
        container.get<LoggerService>(LoggerService),
        container.get<EnvironmentConfig>(ContainerKeys.envConfig),
        apigClientFactory,
        credentialsFactory,
        apiBaseUrl,
        accountNum,
        roleName
      );
    };
  });
} catch (error) {
  // Can't rely on the LoggerService class here, since it might have failed during init
  const logOutput = {
    level: "error",
    message: "Error occurred during IOC initialization",
    data: error?.message ?? error,
    timestamp: new Date().toISOString(),
    location: "ioc.container"
  };

  // eslint-disable-next-line no-console
  console.log(logOutput);
}

export { container };
