import { injectable } from "inversify";
import * as yup from "yup";
import { BadRequestError } from "../../errors/badRequest.error";
import { ValidationError } from "../../errors/validation.error";

export enum ParameterErrorIssue {
  Required = "required",
  Malformed = "malformed",
  Empty = "empty",
  MaxCharactersExceeded = "maxCharactersExceeded",
  Invalid = "invalid"
}

const errorTypeMap = {
  max: ParameterErrorIssue.MaxCharactersExceeded,
  min: ParameterErrorIssue.Empty,
  typeError: ParameterErrorIssue.Malformed,
  noUnknown: ParameterErrorIssue.Invalid
};

@injectable()
export class SchemaValidator {
  // eslint-disable-next-line @typescript-eslint/ban-types
  validateModel<T extends object>(bodyString: string, schema: yup.ObjectSchema<T>): T {
    let body;

    try {
      body = JSON.parse(bodyString) || {};
    } catch (error) {
      throw new BadRequestError(error.message);
    }

    const strictValidationOptions: yup.ValidateOptions = {
      abortEarly: false,
      recursive: true,
      context: null,
      strict: true,
      stripUnknown: false
    };

    const stripUnknownValidationOptions: yup.ValidateOptions = {
      abortEarly: false,
      recursive: true,
      context: null,
      strict: false,
      stripUnknown: true
    };

    try {
      // A bug in Yup prevents 'stripUnknown: true' from functioning while 'strict: true'.

      // To get around this, we first validate with 'strict: true' & 'stripUnknown: false',
      // then validate the result with 'strict: false' & 'stripUnknown: true'.

      // This gives us the benefits of strict mode, like prevention of type coercion,
      // as well as the ability to strip properties not defined in the schema.
      const strictlyValidatedBody = schema.validateSync(body, strictValidationOptions);

      return schema.validateSync(strictlyValidatedBody, stripUnknownValidationOptions);
    } catch (error) {
      let paramErrorInputs = [];
      if (error instanceof yup.ValidationError) {
        paramErrorInputs = error.inner.map((innerError) => {
          const param = innerError.type === "noUnknown" ? innerError.params["unknown"] : innerError.path;
          const issue = this.getIssue(innerError);
          return { param, issue };
        });
      }

      throw new ValidationError("Validation errors detected with the provided body", paramErrorInputs);
    }
  }

  private getIssue(error: yup.ValidationError): ParameterErrorIssue {
    // Find the mapped type, or return Required error as the default
    return errorTypeMap[error.type] || ParameterErrorIssue.Required;
  }
}
