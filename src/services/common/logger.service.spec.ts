import { LoggerService } from "./logger.service";
import { EnvironmentConfig } from "../../config/env.config";

describe("LoggerService class", () => {
  const envConfig: Partial<EnvironmentConfig> = {
    logLevel: "all",
    region: process.env.AWS_REGION
  };
  let loggerService: LoggerService;
  let lastLogOutput;
  process.env.currentCorrelationId = "unit-test";

  beforeEach(() => {
    loggerService = new LoggerService(envConfig as EnvironmentConfig);
    spyOn(loggerService as any, "_output").and.callFake((message) => {
      lastLogOutput = message;
    });
  });

  describe("maskSecret()", () => {
    it("adds the given parameter to the configSecrets array", () => {
      loggerService.maskSecret("my-secret");
      loggerService.log("Masked: my-secret", {});

      expect((loggerService as any).configSecrets).toBeTruthy();
      expect((loggerService as any).configSecrets[0]).toBe("my-secret");
      expect(lastLogOutput).toEqual(jasmine.stringMatching("Masked: \\*\\*\\*\\*\\*"));
    });
  });

  describe("log()", () => {
    it("logs output at the info log level", () => {
      loggerService.log("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("info"));
    });
  });

  describe("trace()", () => {
    it("logs output at the trace log level", () => {
      loggerService.trace("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("trace"));
    });
  });

  describe("info()", () => {
    it("logs output at the info log level", () => {
      loggerService.info("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("info"));
    });
  });

  describe("debug()", () => {
    it("logs output at the debug log level", () => {
      loggerService.debug("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("debug"));
    });
  });

  describe("warn()", () => {
    it("logs output at the warning log level", () => {
      loggerService.warn("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("warn"));
    });
  });

  describe("error()", () => {
    it("logs output at the error log level", () => {
      loggerService.error("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("error"));
    });
  });

  describe("fatal()", () => {
    it("logs output at the fatal log level", () => {
      loggerService.fatal("a", "b", "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toEqual(jasmine.stringMatching("fatal"));
    });
  });

  describe("writeLog()", () => {
    it("handles circular JSON references in the data object", () => {
      const objectA = { referenceToB: null };
      const objectB = { referenceToA: objectA };
      objectA.referenceToB = objectB;

      loggerService.error("circular", objectA, "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toContain("circular");
      expect(lastLogOutput).toContain('"data":"Unable to serialize error data"');
    });

    it("handles serialization errors of the data object", () => {
      const bigInt = BigInt(1);

      // We force a more serious serialization error by passing a BigInt in the data object
      loggerService.error("serialize", { bigInt }, "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toContain('"data":"Unable to serialize error data"');
    });

    it("handles internal serialization errors", () => {
      const bigInt = BigInt(1) as unknown as string;

      // We force a more serious serialization error by passing a BigInt in the classname parameter
      loggerService.error("circular", {}, bigInt);

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toContain('"message":"Error trying to serialize for logs');
    });

    it("outputs an empty object when data parameter is not defined", () => {
      loggerService.error("empty", undefined, "classname");

      expect((loggerService as any)._output).toHaveBeenCalled();
      expect(lastLogOutput).toContain('"data":"{}"');
    });

    it("doesn't output when the log level isn't high enough", () => {
      // Create a different instance of our LoggerService, which is configured with error level logging.
      // Extend the default test config but change the loglevel.
      const errorLevelConfig: Partial<EnvironmentConfig> = { ...envConfig, logLevel: "error" };
      const errorLoggerService = new LoggerService(errorLevelConfig as EnvironmentConfig);

      // Create the spy for this service.
      spyOn(errorLoggerService as any, "_output").and.callFake((message) => {
        lastLogOutput = message;
      });

      errorLoggerService.info("a", "b", "classname");

      // Given the error loglevel config, we expect the output was not called as the level was not high enough.
      expect((errorLoggerService as any)._output).not.toHaveBeenCalled();
    });

    it("doesn't output when the envConfig is not defined", () => {
      const errorLoggerService = new LoggerService(undefined);

      // Create the spy for this service.
      spyOn(errorLoggerService as any, "_output").and.callFake((message) => {
        lastLogOutput = message;
      });

      errorLoggerService.error("no output", undefined, "classname");

      expect((errorLoggerService as any)._output).not.toHaveBeenCalled();
    });
  });
});
