import { inject, injectable } from "inversify";
import { LoggerService } from "./common/logger.service";
import { ExampleExternalService } from "./exampleExternal.service";
import { ContainerKeys } from "../config/ioc.keys";
import { EnvironmentConfig } from "../config/env.config";

export interface HealthServiceResult {
  status: string;
  exampleExternalStatus: string;
  dbStatus: string;
  version: string;
  region: string;
  serviceName: string;
  environmentName: string;
  logLevel: string;
  domain: string;
  executionTime: number;
  exampleExternalResponseTime: number;
  dbResponseTime: string;
  errors: string[];
}

@injectable()
export class HealthService {
  constructor(
    @inject(LoggerService) private logger: LoggerService,
    @inject(ContainerKeys.envConfig) private envConfig: EnvironmentConfig,
    @inject(ExampleExternalService) private exampleExternalService: ExampleExternalService
  ) {}

  async getHealth(options): Promise<HealthServiceResult> {
    this.logger.trace("getHealth called", null, this.constructor.name);

    const startTime = Date.now();

    // Setup the result object
    const result: HealthServiceResult = {
      status: "",
      exampleExternalStatus: "",
      dbStatus: "",
      version: this.envConfig.releaseVersion,
      region: this.envConfig.region,
      serviceName: this.envConfig.serviceName,
      environmentName: this.envConfig.environmentName,
      logLevel: this.envConfig.logLevel,
      domain: this.envConfig.domain,
      executionTime: null,
      exampleExternalResponseTime: 0,
      dbResponseTime: null,
      errors: []
    };

    // Setup the request to the first external integration component (called 'ExampleExternal')
    const exampleExternalOptions = {
      forceFailure: options?.forceExampleExternalFailure
    };
    const exampleExternalStartTime = Date.now();

    try {
      const response = await this.exampleExternalService.ping(exampleExternalOptions);

      result.exampleExternalResponseTime = Date.now() - exampleExternalStartTime;
      result.exampleExternalStatus = "healthy";
      this.logger.debug("ExampleExternal Connection succeeded", response, this.constructor.name);
    } catch (error) {
      // Something went wrong when trying to call ExampleExternal
      result.exampleExternalResponseTime = Date.now() - exampleExternalStartTime;
      result.exampleExternalStatus = "error";
      const errorMessage = "ExampleExternal Status: " + (error?.message ?? error);
      result.errors.push(errorMessage);

      this.logger.error("ExampleExternal connection failed in healthcheck", error, this.constructor.name);
    }

    // If all other statuses are healthy, then overall status is healthy
    if (result.exampleExternalStatus === "healthy") {
      result.status = "healthy";
    } else {
      result.status = "error";
    }

    // Record the total execution time
    result.executionTime = Date.now() - startTime;

    return result;
  }
}
