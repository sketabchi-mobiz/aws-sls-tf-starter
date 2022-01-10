import { inject, injectable } from "inversify";
import { ContainerKeys } from "../../config/ioc.keys";
import { EnvironmentConfig } from "../../config/env.config";

@injectable()
export class LoggerService {
  // eslint-disable-next-line @typescript-eslint/ban-types
  private _output: Function;
  private logLevels: any;
  private configSecrets: string[];

  constructor(@inject(ContainerKeys.envConfig) private envConfig: EnvironmentConfig) {
    // eslint-disable-next-line no-console
    this._output = console.log;

    // Log levels standard defined by Log4j
    this.logLevels = {
      off: 0,
      fatal: 100,
      error: 200,
      warn: 300,
      info: 400,
      debug: 500,
      trace: 600,
      all: 10000
    };

    this.configSecrets = [];
  }

  maskSecret(secret: string): void {
    this.configSecrets.push(secret);
  }

  // The log() function is an alias to allow our Logger class to be used as a logger for AWS sdk calls
  log(message: string, data: any, className?: string): void {
    this.writeLog("info", message, data, className);
  }
  fatal(message: string, data: any, className?: string): void {
    this.writeLog("fatal", message, data, className);
  }
  error(message: string, data: any, className?: string): void {
    this.writeLog("error", message, data, className);
  }
  warn(message: string, data: any, className?: string): void {
    this.writeLog("warn", message, data, className);
  }
  info(message: string, data: any, className?: string): void {
    this.writeLog("info", message, data, className);
  }
  debug(message: string, data: any, className?: string): void {
    this.writeLog("debug", message, data, className);
  }
  trace(message: string, data: any, className?: string): void {
    this.writeLog("trace", message, data, className);
  }

  writeLog(level: string, message: string, data: any, className?: string): void {
    if (this.envConfig?.logLevel && this.logLevels[level] <= this.logLevels[this.envConfig.logLevel]) {
      let dataOutput = data !== undefined ? data : {};
      if (dataOutput instanceof Error) {
        // Improved serialization for Error objects
        dataOutput = "Error message: " + dataOutput.message + "; Stack: " + dataOutput.stack;
      } else {
        try {
          // JSON.stringify data objects
          dataOutput = JSON.stringify(dataOutput);
        } catch (jsonError) {
          // squealch stringify errors so that we can output the original log message
          dataOutput = "Unable to serialize error data";
        }
      }

      // Project-specific convention for Error output structure
      const outObject = {
        level: level,
        message: message,
        data: dataOutput,
        timestamp: new Date().toISOString(),
        location: className,
        correlationId: process.env.currentCorrelationId
      };

      let outString: string;
      try {
        outString = JSON.stringify(outObject);
      } catch (err) {
        outString = `{"level":"error","message":"Error trying to serialize for logs; ${err}"}`;
      }

      // Mask secrets from being written to the logs
      this.configSecrets.forEach((secret) => {
        outString = outString.replace(secret, "*****");
      });

      this._output(outString);
    }
  }
}
