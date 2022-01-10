import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { inject, injectable } from "inversify";
import { BadRequestError } from "../errors/badRequest.error";
import { ProxyError } from "../errors/proxy.error";
import { UnauthorizedError } from "../errors/unauthorized.error";
import { NotFoundError } from "../errors/notFound.error";
import { ValidationError } from "../errors/validation.error";
import { LoggerService } from "../services/common/logger.service";

@injectable()
export class BaseController {
  protected HTTP_CODE_OK = 200;
  protected HTTP_CODE_CREATED = 201;
  protected HTTP_CODE_BAD_REQUEST = 400;
  protected HTTP_CODE_UNAUTHORIZED = 401;
  protected HTTP_CODE_NOT_FOUND = 404;
  protected HTTP_CODE_INTERNAL_SERVER_ERROR = 500;
  protected HTTP_CODE_GATEWAY_TIMEOUT = 504;

  constructor(@inject(LoggerService) protected logger: LoggerService) {}

  async invoke(
    callback: (ev: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>,
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> {
    this.logger.trace("invoke called", null, this.constructor.name);

    try {
      this.verifyCorrelationId(event);

      const controllerCallback = callback.bind(this);
      return await controllerCallback(event);
    } catch (error) {
      return this.handleServiceErrors(error);
    }
  }

  createResponseModel(statusCode: number, bodyObject: any): APIGatewayProxyResult {
    const logObject = { statusCode: statusCode, bodyObject: bodyObject };
    this.logger.debug("Creating response", logObject, this.constructor.name);

    return {
      statusCode: statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(bodyObject)
    };
  }

  createSuccessResponse(resultObject: any): APIGatewayProxyResult {
    const bodyObject = {
      result: resultObject
    };

    return this.createResponseModel(this.HTTP_CODE_OK, bodyObject);
  }

  createErrorResponse(errorCode: number, message: string, data: any): APIGatewayProxyResult {
    let dataMessage;
    if (typeof data === "string") {
      dataMessage = data;
    } else {
      dataMessage = data?.message ?? data;
    }

    const bodyObject = {
      errorCode: errorCode,
      message: message,
      data: dataMessage
    };

    return this.createResponseModel(errorCode, bodyObject);
  }

  createUnexpectedErrorResponse(data: any): APIGatewayProxyResult {
    return this.createErrorResponse(this.HTTP_CODE_INTERNAL_SERVER_ERROR, "An unexpected error occurred!", data);
  }

  handleServiceErrors(error: Error): APIGatewayProxyResult {
    this.logger.error("Service Error Occurred", error, this.constructor.name);

    // Handle errors
    if (error instanceof BadRequestError) {
      return this.createErrorResponse(this.HTTP_CODE_BAD_REQUEST, error.message, {});
    } else if (error instanceof UnauthorizedError) {
      return this.createErrorResponse(this.HTTP_CODE_UNAUTHORIZED, error.message, {});
    } else if (error instanceof NotFoundError) {
      return this.createErrorResponse(this.HTTP_CODE_NOT_FOUND, error.message, {});
    } else if (error instanceof ProxyError) {
      return this.createErrorResponse(this.HTTP_CODE_GATEWAY_TIMEOUT, error.message, {});
    } else if (error instanceof ValidationError) {
      return this.createErrorResponse(this.HTTP_CODE_BAD_REQUEST, error.message, error.data);
    }

    return this.createUnexpectedErrorResponse(error);
  }

  verifyCorrelationId(eventObject: APIGatewayProxyEvent): void {
    this.logger.trace("verifyCorrelationId() called", {}, this.constructor.name);

    // extract correlation object from event header
    const correlationObject = this.extractCorrelationObject(eventObject);

    // Store the correlation object on the process object
    process["correlationObject"] = correlationObject;
    process.env.currentCorrelationId = correlationObject?.correlationId;
  }

  verifyRequiredQueryStringParams(eventObject: APIGatewayProxyEvent, requiredQueryStringParams: string[]): void {
    const queryStringPropertyName = "queryStringParameters";

    this.logger.trace(
      "verifyRequiredQueryStringParams() called",
      { qs: requiredQueryStringParams },
      this.constructor.name
    );

    const errors = this.processPropertySet(eventObject, queryStringPropertyName, requiredQueryStringParams);

    // If there are any errors, throw an Error object with all of the messages
    if (errors.length > 0) {
      throw new BadRequestError(errors.join(" "));
    }
  }

  private extractCorrelationObject(eventObject: APIGatewayProxyEvent): any {
    // Require the 'Correlation-Object' header
    if (!eventObject.headers) {
      throw new BadRequestError("Event headers are missing or malformed.");
    }

    let correlationObjectHeaderName = "correlation-object";

    // get the current correlationObject from headers
    Object.keys(eventObject.headers).forEach((headerName) => {
      if (headerName.toLowerCase() === correlationObjectHeaderName) {
        // The headerName itself may be any capitalization. So this checks for a case-insensitive match.
        correlationObjectHeaderName = headerName;
      }
    });

    let correlationObject: any;

    try {
      // Try to parse the header as JSON. If it fails or if there isn't a correlationId property, then we throw an error
      correlationObject = JSON.parse(eventObject.headers[correlationObjectHeaderName]);
    } catch (error) {
      throw new BadRequestError("A Correlation-Object header is required in the request.");
    }

    if (!correlationObject.correlationId) {
      throw new BadRequestError('The field "correlationId" is missing in the request\'s Correlation-Object.');
    }

    return correlationObject;
  }

  private processPropertySet(
    requestEvent: APIGatewayProxyEvent,
    propertySetName: string,
    requiredProperties: string[]
  ): string[] {
    const errors: string[] = [];
    const propertySet = requestEvent[propertySetName];

    if (requiredProperties?.length > 0) {
      // fail if the propertySet isn't defined
      if (propertySet === undefined || propertySet === null) {
        errors.push(`Request event is malformed. The "${propertySetName}" object is missing.`);
      } else {
        // Check for each of the required properties
        requiredProperties.forEach((propertyName) => {
          const value = propertySet[propertyName];

          // If the value isn't there or is blank, then add it to the errors list
          if (value === undefined || value === null || value === "") {
            errors.push(`The parameter "${propertyName}" is required in the request's ${propertySetName}.`);
          }
        });
      }
    }
    return errors;
  }
}
