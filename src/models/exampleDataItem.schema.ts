import * as yup from "yup";

// The RESTful API contracts for Requests and Responses

const AddressSchema = yup.object({
  address1: yup.string().nullable(),
  address2: yup.string().nullable(),
  city: yup.string().nullable(),
  stateOrProvince: yup.string().nullable(),
  zipOrPostalCode: yup.string().nullable(),
  country: yup.string().nullable()
});

export const CreateExampleDataItemRequestSchema = yup.object({
  name: yup.string().required(),
  email: yup.string().nullable().min(4),
  exampleNumber: yup.number().nullable(),
  address: AddressSchema.nullable()
});

export const newSchema = CreateExampleDataItemRequestSchema.clone().concat(yup.object({ id: yup.string() }));

// Extend the Create Request schema to build the Update Request schema
export const UpdateExampleDataItemRequestSchema = CreateExampleDataItemRequestSchema.clone().concat(
  yup.object({
    id: yup.string(),
    updatedTimestamp: yup.date()
  })
);

// Extend the Create schema to build the Response schema
export const ExampleDataItemResponseSchema = CreateExampleDataItemRequestSchema.clone().concat(
  yup.object({
    id: yup.string(),
    createdTimestamp: yup.date(),
    updatedTimestamp: yup.date(),
    createdBy: yup.string(),
    updatedBy: yup.string()
  })
);

export type ExampleDataItemAddress = yup.InferType<typeof AddressSchema>;
export type CreateExampleDataItemRequest = yup.InferType<typeof CreateExampleDataItemRequestSchema>;
export type UpdateExampleDataItemRequest = yup.InferType<typeof UpdateExampleDataItemRequestSchema>;
export type ExampleDataItemResponse = yup.InferType<typeof ExampleDataItemResponseSchema>;
