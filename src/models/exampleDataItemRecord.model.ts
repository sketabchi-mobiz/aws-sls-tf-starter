import { ExampleDataItemAddress } from "./exampleDataItem.schema";

// The DynamoDB model
export interface ExampleDataItemRecord {
  pk: string;
  sk: string;
  itemId?: string;
  name?: string;
  email?: string;
  exampleNumber?: number;
  address?: ExampleDataItemAddress;
  createdTimestamp?: string;
  updatedTimestamp?: string;
  createdBy?: string;
  updatedBy?: string;
}
