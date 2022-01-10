import * as yup from "yup";
import { Chance } from "chance";
import { SchemaValidator, ParameterErrorIssue } from "./schemaValidator.service";
import { BadRequestError } from "../../errors/badRequest.error";

const chance = new Chance();

interface NestedModel {
  x: string;
  y: number;
}

interface TestModel {
  a: string;
  b?: number;
  c: string[];
  child?: NestedModel;
}

const nestedModelSchema = yup.object({
  x: yup.string().required(),
  y: yup.number().required(),
  z: yup.string().notRequired().min(1),
  maxChar: yup.string().notRequired().max(4)
});

const testModelSchema = yup.object({
  a: yup.string().required(),
  b: yup.number().nullable(),
  c: yup.array(yup.string()),
  child: nestedModelSchema.notRequired().default(undefined)
});

const noUnknownSchema = testModelSchema.noUnknown();

describe("SchemaValidator", () => {
  const schemaValidator = new SchemaValidator();

  describe("validateModel()", () => {
    describe("successfully", () => {
      it("validates schema with valid input", () => {
        const expectedName = chance.name();
        const expectedAge = chance.integer({ min: 20, max: 60 });
        const expectedCity = chance.city();

        const result = schemaValidator.validateModel<TestModel>(
          `{"a":"${expectedName}","b":${expectedAge},"c":["${expectedCity}"]}`,
          testModelSchema
        );

        expect(result.a).toEqual(expectedName);
        expect(result.b).toEqual(expectedAge);
        expect(result.c).toEqual([expectedCity]);
        expect(result.child).toBeUndefined();
      });

      it("validates schema with valid embedded object", () => {
        const expectedName = chance.name();
        const expectedCity = chance.city();
        const expectedChildA = chance.word();
        const expectedChildB = chance.integer({ min: 20, max: 60 });

        const result = schemaValidator.validateModel<TestModel>(
          `{"a":"${expectedName}","b":null,"c":["${expectedCity}"], "child": { "x": "${expectedChildA}", "y": ${expectedChildB} }}`,
          testModelSchema
        );

        expect(result.a).toEqual(expectedName);
        expect(result.b).toEqual(null);
        expect(result.c).toEqual([expectedCity]);
        expect(result.child).toBeDefined();
        expect(result.child.x).toEqual(expectedChildA);
        expect(result.child.y).toEqual(expectedChildB);
      });

      it("strips unknown properties from a valid model", () => {
        const expectedName = chance.name();
        const expectedAge = chance.integer({ min: 20, max: 60 });
        const expectedCity = chance.city();

        const givenRandomValue = chance.word();
        const givenRandomField = chance.word();

        const result = schemaValidator.validateModel<TestModel>(
          `{"a":"${expectedName}","b":${expectedAge},"c":["${expectedCity}"],"${givenRandomField}": "${givenRandomValue}"}`,
          testModelSchema
        );

        const rawBody = JSON.parse(JSON.stringify(result));
        expect(result.a).toEqual(expectedName);
        expect(result.b).toEqual(expectedAge);
        expect(result.c).toEqual([expectedCity]);
        expect(rawBody[givenRandomField]).toBeUndefined();
      });
    });

    describe("throws an error", () => {
      it("when the model doesn't pass validation", () => {
        const json = JSON.stringify({
          b: chance.word(),
          c: [chance.integer({ min: 1, max: 100 }), chance.integer({ min: 1, max: 100 })],
          child: {
            x: chance.integer({ min: 1, max: 100 }),
            z: "",
            maxChar: "12345"
          }
        });

        const expectedParamErrorInput = [
          {
            param: "a",
            issue: ParameterErrorIssue.Required
          },
          {
            param: "b",
            issue: ParameterErrorIssue.Malformed
          },
          {
            param: "child.maxChar",
            issue: ParameterErrorIssue.MaxCharactersExceeded
          },
          {
            param: "child.x",
            issue: ParameterErrorIssue.Malformed
          },
          {
            param: "child.y",
            issue: ParameterErrorIssue.Required
          },
          {
            param: "child.z",
            issue: ParameterErrorIssue.Empty
          },
          {
            param: "c[0]",
            issue: ParameterErrorIssue.Malformed
          },
          {
            param: "c[1]",
            issue: ParameterErrorIssue.Malformed
          }
        ];

        try {
          schemaValidator.validateModel<TestModel>(json, testModelSchema);
          fail("was supposed to throw an exception");
        } catch (error) {
          expect(error.data).toEqual(expectedParamErrorInput);
        }
      });

      it("when unknown properties are not allowed", () => {
        const expectedParamErrorInput = [
          {
            param: "m",
            issue: ParameterErrorIssue.Invalid
          }
        ];

        try {
          schemaValidator.validateModel<TestModel>('{"a":"test","m":1}', noUnknownSchema);
          fail("was supposed to throw an exception");
        } catch (error) {
          expect(error.data).toEqual(expectedParamErrorInput);
        }
      });

      it("when handling a JSON parse error", () => {
        const testFunction = (): void => {
          schemaValidator.validateModel<TestModel>("{ not valid, json]", testModelSchema);
        };
        expect(testFunction).toThrowError(BadRequestError);
      });

      it("when the model is null", () => {
        const expectedParamErrorInput = [
          {
            param: "a",
            issue: ParameterErrorIssue.Required
          }
        ];

        try {
          schemaValidator.validateModel<TestModel>(null, testModelSchema);
          fail("was supposed to throw an exception");
        } catch (error) {
          expect(error.data).toEqual(expectedParamErrorInput);
        }
      });
    });
  });
});
