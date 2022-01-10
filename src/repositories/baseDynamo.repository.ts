/*
  Docs for interacting with the DynamoDB Document Client:
  https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/dynamodb-example-document-client.html
*/

/*
  This BaseDynamoRepository further simplifies the interface with DynamoDb by providing functions that allow
  for key-value pairs to be used in queries, filters, negation filters (NOT conditions), and simple arrays
  for projection expressions. This implementation also avoids conflicts with DynamoDb keywords.

  There is a lot that can be improved here, but this can be a good start to subclass implementations of
  Repository classes that use DynamoDb as a data source.
*/

import { DynamoDB } from "aws-sdk";
import { LoggerService } from "../services/common/logger.service";
import { inject, injectable } from "inversify";

// Create type aliases to make working with the DocumentClient easier
type AttributeMap = DynamoDB.DocumentClient.AttributeMap;
type ExpressionAttributeNameMap = DynamoDB.DocumentClient.ExpressionAttributeNameMap;
type ExpressionAttributeValueMap = DynamoDB.DocumentClient.ExpressionAttributeValueMap;
type UpdateItemInput = DynamoDB.DocumentClient.UpdateItemInput;
type DeleteItemInput = DynamoDB.DocumentClient.DeleteItemInput;
type GetItemInput = DynamoDB.DocumentClient.GetItemInput;
type PutItemInput = DynamoDB.DocumentClient.PutItemInput;
type QueryInput = DynamoDB.DocumentClient.QueryInput;
type QueryOutput = DynamoDB.DocumentClient.QueryOutput;
type ScanInput = DynamoDB.DocumentClient.ScanInput;
type ScanOutput = DynamoDB.DocumentClient.ScanOutput;
type DescribeTableInput = DynamoDB.DocumentClient.DescribeTableInput;
type TransactWriteItemsInput = DynamoDB.DocumentClient.TransactWriteItemsInput;

// Define our own union type of FilterInput used for both queries and scans
type FilterInput = QueryInput | ScanInput;

export interface FilterInputParams {
  filters?: Record<string, any>;
  negationFilters?: Record<string, any>;
  fields?: string[];
}

export interface QueryInputParams {
  indexName?: string;
  partitionKeyName?: string;
  partitionKeyValue: string;
  sortKeyName?: string;
  sortKeyValue?: string;
  filterInputParams?: FilterInputParams;
}

interface FilterParams {
  filterExpression: string;
  expressionAttributeNames: ExpressionAttributeNameMap;
  expressionAttributeValues: ExpressionAttributeValueMap;
}

interface ProjectionParams {
  projectionExpression: string;
  expressionAttributeNames: ExpressionAttributeNameMap;
}

export interface DynamoTransactionWriteItem {
  record?: AttributeMap;
  operation: string;
  partitionKeyValue?: string;
  sortKeyValue?: string;
}

@injectable()
export class BaseDynamoRepository {
  protected tableName: string;
  protected partitionKeyName: string;
  protected sortKeyName: string;

  static readonly PUT = "PUT";
  static readonly UPDATE = "UPDATE";
  static readonly DELETE = "DELETE";

  constructor(
    @inject(LoggerService) protected logger: LoggerService,
    @inject(DynamoDB.DocumentClient) protected documentClient: DynamoDB.DocumentClient,
    @inject(DynamoDB) protected dynamodb: DynamoDB
  ) {}

  /*
   * init()
   * Due to the limitations of the IOC tool, these properties must be passed into an init function, instead
   * of the constructor. Derived classes must call init() as part of their constructor
   */
  protected init(tableName: string, partitionKeyName: string, sortKeyName?: string): void {
    this.logger.trace("init() called", { tableName, partitionKeyName, sortKeyName }, this.constructor.name);
    this.tableName = tableName;
    this.partitionKeyName = partitionKeyName;
    this.sortKeyName = sortKeyName;
  }

  /*
   * put()
   * Use this function to create a new Item in the database table.
   * Use this function to completely overwrite the Item that matches the given pk and sk
   * Properties that are not provided will be removed from the database record.
   */
  protected async put(record: AttributeMap): Promise<AttributeMap> {
    this.logger.trace("put() called", { record }, this.constructor.name);

    const params: PutItemInput = {
      TableName: this.tableName,
      Item: record
    };

    await this.documentClient.put(params).promise();

    // The return valuee from the put() function is not particularly useful
    // So we return the record that was passed in.
    return record;
  }

  /*
   * update()
   * Update a partial record in the database.
   * Use this function to overwrite only the specific properties provided in the AttributeMap input.
   * The updates parameter object must include the partition key and the sort key.
   * Properties that are not provided are left unchanged on the record in the database.
   * Returns the updated record from the database.
   */
  protected async update(updates: AttributeMap): Promise<AttributeMap> {
    this.logger.trace("update() called", { updates }, this.constructor.name);

    const updateItemInput = this.generateUpdateParams(updates);

    const result = await this.documentClient.update(updateItemInput).promise();
    return result.Attributes;
  }

  /*
   * get()
   * Use this function to read a single item record from the database.
   * If the table defines a sort key, then the sortKeyValue must be provided
   */
  protected async get(partitionKeyValue: string, sortKeyValue?: string): Promise<AttributeMap> {
    this.logger.trace("get() called", { partitionKeyValue, sortKeyValue }, this.constructor.name);

    const params: GetItemInput = {
      TableName: this.tableName,
      Key: this.generatePrimaryKey(partitionKeyValue, sortKeyValue)
    };

    const result = await this.documentClient.get(params).promise();
    return result.Item;
  }

  /*
   * delete()
   * Use this function to delete a single item record from the database.
   * If the table defines a sort key, then the sortKeyValue must be provided
   * Returns the record as it existed before the deletion.
   */
  protected async delete(partitionKeyValue: string, sortKeyValue?: string): Promise<AttributeMap> {
    this.logger.trace("delete() called", { partitionKeyValue, sortKeyValue }, this.constructor.name);

    const params: DeleteItemInput = {
      TableName: this.tableName,
      Key: this.generatePrimaryKey(partitionKeyValue, sortKeyValue),
      ReturnValues: "ALL_OLD" // Returns the attribute values of the record before the deletion
    };

    const result = await this.documentClient.delete(params).promise();
    return result.Attributes;
  }

  /*
   * queryLocalSecondaryIndex()
   * Use this function to query for any number of items based on a Local Secondary Index
   * An LSI always has the same Partition Key as the base table, so specifying partitionKeyName is not necessary.
   * Since the sort key value of a Local Secondary Index isn't a unique key, it's possible to get an array of matching results.
   * This function does not paginate results, so don't use this if there is a possibility of more than 1MB of data returned.
   * For large dataset results, use queryWithFilters()
   */
  protected async queryLocalSecondaryIndex(
    indexName: string,
    partitionKeyValue: string,
    sortKeyName: string,
    sortKeyValue: string
  ): Promise<QueryOutput> {
    this.logger.trace(
      "queryLocalSecondaryIndex() called",
      { indexName, partitionKeyValue, sortKeyName, sortKeyValue },
      this.constructor.name
    );

    const queryInput: QueryInput = this.generateQueryInput({ indexName, partitionKeyValue, sortKeyName, sortKeyValue });

    return this.documentClient.query(queryInput).promise();
  }

  /*
   * queryGlobalSecondaryIndex()
   * Use this function to query for any number of items based on a Global Secondary Index.
   * A GSI always has a DIFFERENT Partition Key as the base table, so specifying partitionKeyName is required.
   * Since the sort key value of a Global Secondary Index isn't a unique key, it's possible to get an array of matching results.
   * This function does not paginate results, so don't use this if there is a possibility of more than 1MB of data returned.
   * For large dataset results, use queryWithFilters()
   */
  protected async queryGlobalSecondaryIndex(
    indexName: string,
    partitionKeyName: string,
    partitionKeyValue: string,
    sortKeyName: string,
    sortKeyValue: string
  ): Promise<QueryOutput> {
    this.logger.trace(
      "queryGlobalSecondaryIndex() called",
      { indexName, partitionKeyName, partitionKeyValue, sortKeyName, sortKeyValue },
      this.constructor.name
    );

    const queryInput: QueryInput = this.generateQueryInput({
      indexName,
      partitionKeyName,
      partitionKeyValue,
      sortKeyName,
      sortKeyValue
    });

    return this.documentClient.query(queryInput).promise();
  }

  /*
   * queryWithFilters()
   * Use this function to query for any number of items based on just a partition key and filter criteria.
   * This function supports querying the base table, LSI indexes, and GSI indexes, using the QueryInputParams object.
   * This function will paginate through all of the Dynamo results to ensure that a complete data set is returned.
   */
  protected async queryWithFilters(
    params: QueryInputParams,
    filterInputParams: FilterInputParams
  ): Promise<AttributeMap[]> {
    this.logger.trace("queryWithFilters() called", { params, filterInputParams }, this.constructor.name);

    const queryInput = this.generateQueryInput(params);
    const filterInput: FilterInput = this.generateFilterInput(filterInputParams);

    // Combine the two input objects together into the queryInput
    if (filterInput.ExpressionAttributeNames) {
      queryInput.ExpressionAttributeNames = queryInput.ExpressionAttributeNames || {};
      Object.assign(queryInput.ExpressionAttributeNames, filterInput.ExpressionAttributeNames);
    }
    if (filterInput.ExpressionAttributeValues) {
      queryInput.ExpressionAttributeValues = queryInput.ExpressionAttributeValues || {};
      Object.assign(queryInput.ExpressionAttributeValues, filterInput.ExpressionAttributeValues);
    }
    if (filterInput.FilterExpression) {
      queryInput.FilterExpression = filterInput.FilterExpression;
    }

    return this.queryWithFiltersHelper(queryInput);
  }

  /*
   * scanWithFilters()
   * WARNING: Use this function sparingly!
   * A scan operation in DynamoDB is very slow, especially as the amount of data in the table scales up.
   * Use this function to scan through every record in the table, applying filters after the data is retreived.
   * Filters supported by this function are simple equals and not equals.
   *
   * Example usage:
   * const recordsArray = this.scanWithFilters({
   *   filters: { status: "active" }, // Only return records that have status = "active"
   *   negationFilters: { deleted: true }, // AND don't return any records that have deleted = true
   *   fields: [ "score" ] // Instead of including all fields in the response, just include the "score" field
   * });
   */
  protected async scanWithFilters(filterInputParams: FilterInputParams): Promise<AttributeMap[]> {
    this.logger.trace("scanWithFilters() called", { filterInputParams }, this.constructor.name);

    const scanInput = this.generateFilterInput(filterInputParams);

    return this.scanWithFiltersHelper(scanInput);
  }

  /*
   * generatePrimaryKey()
   * Given a list of fields, create the projection expression with aliased field names, to avoid reserved word conflicts.
   */
  protected generatePrimaryKey(partitionKeyValue: string, sortKeyValue?: string): DynamoDB.DocumentClient.Key {
    const key: DynamoDB.DocumentClient.Key = {
      [this.partitionKeyName]: partitionKeyValue
    };

    // If the table has a sort key defined, then it must be specified in the Primary Key object
    if (this.sortKeyName) {
      // Verify that the sort key is provided
      if (sortKeyValue === undefined) {
        throw new Error(
          `The attribute "${this.sortKeyName}" is required in the primary key, because it is the sort key.`
        );
      }

      key[this.sortKeyName] = sortKeyValue;
    }

    return key;
  }

  /*
   * generateQueryInput()
   * Given the parameters, creates the QueryInput object to perform a query on the table.
   * Dynamodb has reserved words that conflict if the table AttributeName uses one of these.
   * This function converts AttributeNames into expressionAttributeNames to avoid reserved word conflicts.
   * In the QueryInputParams, the partitionKeyName only needs to be specified if you are querying from a GSI.
   *
   * Example usage:
   * const queryInput = this.generateQueryInput({
   *   indexName: "storeId",
   *   partitionKeyValue: "TENANT#12345",
   *   sortKeyName: "storeId",
   *   sortKeyValue: "STORE#90210"
   * });
   */
  protected generateQueryInput(queryParams: QueryInputParams): QueryInput {
    // Build the partition key expression
    let keyConditionExpression = "#pkName = :pkValue";
    const expressionAttributeNames = {
      "#pkName": queryParams.partitionKeyName || this.partitionKeyName
    };
    const expressionAttributeValues = {
      ":pkValue": queryParams.partitionKeyValue
    };

    // Build the sort key expression, if a sort key is specified
    if ((queryParams.sortKeyName || this.sortKeyName) && queryParams.sortKeyValue !== undefined) {
      keyConditionExpression = `${keyConditionExpression} AND #skName = :skValue`;
      // we convert the sortKeyName to an expression attribute to allow querying with reserved words.
      expressionAttributeNames["#skName"] = queryParams.sortKeyName || this.sortKeyName;
      expressionAttributeValues[":skValue"] = queryParams.sortKeyValue;
    }

    const queryInput: QueryInput = {
      TableName: this.tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues
    };

    // If an index is specified, add it to the queryInput
    if (queryParams.indexName) {
      queryInput.IndexName = queryParams.indexName;
    }

    return queryInput;
  }

  /*
   * generateFilterInput()
   * Given the parameters, creates the FilterInput object to be used for either a query or a scan.
   *
   * Example usage:
   * const filterInput = this.generateFilterInput({
   *   filters: { status: "active" }, // Only return records that have status = "active"
   *   negationFilters: { deleted: true }, // AND don't return any records that have deleted = true
   *   fields: [ "score" ] // Instead of including all fields in the response, just include the "score" field
   * });
   */
  protected generateFilterInput(filterInputParams: FilterInputParams): FilterInput {
    this.logger.trace("generateFilterInput() called", { filterInputParams }, this.constructor.name);

    const filters = filterInputParams.filters;
    const negationFilters = filterInputParams.negationFilters;
    const fields = filterInputParams.fields;

    const filterInput: FilterInput = {
      TableName: this.tableName,
      ExpressionAttributeNames: {},
      ExpressionAttributeValues: {},
      FilterExpression: ""
    };

    if (filters && Object.keys(filters).length > 0) {
      const filterParams = this.generateFilterExpression(filters);
      // Add the filter expression and the aliased attribute names and values into the ScanInput object
      filterInput.FilterExpression += filterParams.filterExpression;
      Object.assign(filterInput.ExpressionAttributeNames, filterParams.expressionAttributeNames);
      Object.assign(filterInput.ExpressionAttributeValues, filterParams.expressionAttributeValues);
    }

    if (negationFilters && Object.keys(negationFilters).length > 0) {
      const negationFilterParams = this.generateFilterExpression(negationFilters);
      // Add the aliased attribute names and values into the ScanInput object
      Object.assign(filterInput.ExpressionAttributeNames, negationFilterParams.expressionAttributeNames);
      Object.assign(filterInput.ExpressionAttributeValues, negationFilterParams.expressionAttributeValues);

      // Construct the negation filter (NOT operator)
      let finalFilterExpr = "NOT " + negationFilterParams.filterExpression;
      if (filterInput.FilterExpression.length > 0) {
        finalFilterExpr = "AND (" + finalFilterExpr + ") ";
      }
      filterInput.FilterExpression += finalFilterExpr;
    }

    if (fields) {
      const projectionParams = this.generateProjectionExpression(fields);
      filterInput.ProjectionExpression = projectionParams.projectionExpression;
      // Add the aliased attribute names into the ScanInput object
      Object.assign(filterInput.ExpressionAttributeNames, projectionParams.expressionAttributeNames);
    }

    // if any of these are empty, DynamoDb will throw an error
    if (Object.keys(filterInput.ExpressionAttributeNames).length === 0) {
      delete filterInput.ExpressionAttributeNames;
    }

    if (Object.keys(filterInput.ExpressionAttributeValues).length === 0) {
      delete filterInput.ExpressionAttributeValues;
    }

    if (filterInput.FilterExpression.length === 0) {
      delete filterInput.FilterExpression;
    }

    return filterInput;
  }

  /*
   * generateProjectionExpression()
   * Given a list of fields, create the projection expression with aliased field names, to avoid reserved word conflicts.
   */
  protected generateProjectionExpression(fields: string[]): ProjectionParams {
    this.logger.trace("generateProjectionExpression() called", { fields }, this.constructor.name);

    const projectionParams: ProjectionParams = {
      projectionExpression: "",
      expressionAttributeNames: {}
    };

    // The primary key properties should always be included in the response, and a validation error will occur if they appear
    // in the projection expression twice
    if (fields.indexOf(this.partitionKeyName) === -1) {
      fields.push(this.partitionKeyName);
    }
    if (this.sortKeyName && fields.indexOf(this.sortKeyName) === -1) {
      fields.push(this.sortKeyName);
    }

    const placeholderFields: string[] = [];
    for (const field of fields) {
      // so that we don't risk a specified field being in conflict with a DynamoDb keyword
      const fieldName = "#" + field;
      placeholderFields.push(fieldName);

      projectionParams.expressionAttributeNames[fieldName] = field;
    }
    projectionParams.projectionExpression = placeholderFields.join(",");

    return projectionParams;
  }

  /*
   * generateFilterExpression()
   * Given a list of key-value pair filters, create the filter expression with aliased field names, using equals as the operator.
   */
  protected generateFilterExpression(filters: Record<string, any>): FilterParams {
    this.logger.trace("generateFilterExpression() called", { filters }, this.constructor.name);

    const filterParams: FilterParams = {
      filterExpression: "",
      expressionAttributeNames: {},
      expressionAttributeValues: {}
    };

    const filterKeys = Object.keys(filters);

    // for each attribute that we want to include in our filter
    for (const filterAttribute of filterKeys) {
      // add ANDs between different attributes being checked
      // so that we can filter through multiple table attributes
      if (filterParams.filterExpression.length > 0) {
        filterParams.filterExpression += " AND ";
      }

      // each attribute will be part of the expressionNames property
      // so that we don't risk conflicting with DynamoDb keywords
      const filterAttributeName = "#" + filterAttribute;
      filterParams.expressionAttributeNames[filterAttributeName] = filterAttribute;

      // go through each value of that attribute and create OR statements
      filterParams.filterExpression += "(";
      const attrValues = filters[filterAttribute];
      const length = attrValues.length;
      for (let i = 0; i < length; i++) {
        const currentAttrValueVar = ":" + filterAttribute + i;
        const currentExpression = "#" + filterAttribute + " = " + currentAttrValueVar;

        filterParams.filterExpression += currentExpression + " ";
        filterParams.expressionAttributeValues[currentAttrValueVar] = attrValues[i];

        // add ORs between different values of the same attribute being checked
        if (i < length - 1) {
          filterParams.filterExpression += "OR ";
        }
      }

      filterParams.filterExpression += ")";
    }

    // surround by parantheses for easier concatenation with other condition groups in the expression
    // but if there's only 1 key, then extra parantehese will result in an error
    if (filterKeys.length > 1) {
      filterParams.filterExpression = "(" + filterParams.filterExpression + ") ";
    }

    return filterParams;
  }

  /*
   * generateUpdateParams()
   * Create the UpdateItemInput object needed to make a partial update request on the database table, for a single item.
   */
  protected generateUpdateParams(updates: AttributeMap): UpdateItemInput {
    this.logger.trace("generateUpdateParams() called", { updates }, this.constructor.name);

    // Verify that the partition key and sort key are included in the updates object
    if (!updates[this.partitionKeyName]) {
      throw new Error(
        `The attribute "${this.partitionKeyName}" is required when updating a record, because it is the partition key.`
      );
    }
    if (this.sortKeyName && updates[this.sortKeyName] === undefined) {
      throw new Error(
        `The attribute "${this.sortKeyName}" is required when updating a record, because it is the sort key.`
      );
    }

    const expressionAttributeNames: ExpressionAttributeNameMap = {};
    const expressionAttributeValues: ExpressionAttributeValueMap = {};
    let updateExpression: string;

    // Convert each property into an alias to avoid keyword collisions
    for (const property in updates) {
      // Don't add the partition key or sort key to the update expression
      if (property === this.partitionKeyName || property === this.sortKeyName) {
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(updates, property) && updates[property] !== undefined) {
        const propertyNameAlias = "#" + property;
        const propertyValueAlias = ":" + property;

        if (updateExpression) {
          // Append to the update expression
          updateExpression += ", ";
        } else {
          // Begin the update expression
          updateExpression = "SET ";
        }

        // This adds the assignment expression, using the aliases to avoid keyword collisions
        // e.g. "#status = :status"
        updateExpression += `${propertyNameAlias} = ${propertyValueAlias}`;

        // This sets the references for the aliases
        // e.g. expressionAttributeNames["#status"] = "status"
        // e.g. expressionAttributeValues[":status"] = "active"
        expressionAttributeNames[propertyNameAlias] = property;
        expressionAttributeValues[propertyValueAlias] = updates[property];
      }
    }

    return {
      TableName: this.tableName,
      Key: this.generatePrimaryKey(updates[this.partitionKeyName], updates[this.sortKeyName]),
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };
  }

  /*
   * queryWithFiltersHelper()
   * This helper function starts a recursion chain to query the table through all of the paginated results.
   * DynamoDB has a maximum result size of 1MB, so if there is more data than that, it must be paginated.
   */
  protected async queryWithFiltersHelper(
    queryInput: QueryInput,
    aggregatedData: AttributeMap[] = []
  ): Promise<AttributeMap[]> {
    this.logger.trace("queryWithFiltersHelper() called", { queryInput, aggregatedData }, this.constructor.name);

    const result = await this.documentClient.query(queryInput).promise();
    // After the first scan, use the "paginationHelper" function to recursively load all the paginated data.
    return this.paginationHelper(aggregatedData, this.queryWithFiltersHelper, queryInput, result);
  }

  /*
   * scanWithFiltersHelper()
   * This helper function starts a recursion chain to scan the entire table through all of the paginated results.
   * DynamoDB has a maximum result size of 1MB, so if there is more data than that, it must be paginated.
   */
  protected async scanWithFiltersHelper(
    scanInput: ScanInput,
    aggregatedData: AttributeMap[] = []
  ): Promise<AttributeMap[]> {
    this.logger.trace("scanWithFiltersHelper() called", { scanInput, aggregatedData }, this.constructor.name);

    const result = await this.documentClient.scan(scanInput).promise();
    // After the first scan, use the "paginationHelper" function to recursively load all the paginated data.
    return this.paginationHelper(aggregatedData, this.scanWithFiltersHelper, scanInput, result);
  }

  /*
   * paginationHelper()
   * This helper function evaluates whether the result set was paginated or completed.
   * The callback function is called with the aggregated data, if there are more pages to be loaded.
   * The aggregated data is returned if there are no more result pages.
   * DynamoDB has a maximum result size of 1MB, so if there is more data than that, it must be paginated.
   */
  protected paginationHelper(
    aggregatedData: AttributeMap[],
    callback: (input: FilterInput, data: AttributeMap[]) => Promise<AttributeMap[]>,
    params: FilterInput,
    data: ScanOutput | QueryOutput
  ): AttributeMap[] {
    this.logger.trace("paginationHelper() called", { aggregatedData, callback, params, data }, this.constructor.name);
    this.logger.debug(
      "Results returned",
      { count: data.Count, lastEvaluatedKey: data.LastEvaluatedKey },
      this.constructor.name
    );

    if (data?.Items?.length > 0) {
      aggregatedData = aggregatedData.concat(data.Items);
    }

    // DynamoDb has a limit of 1 MB of data that it returns
    // if there is more data to return then was returned, then LastEvaluatedKey will point to the
    // last piece of data returned as the point to continue from on the next query/scan
    if (data.LastEvaluatedKey) {
      // Query the next "page" of results
      params.ExclusiveStartKey = data.LastEvaluatedKey;
      // Recursive call to keep on getting the paginated data
      return callback.apply(this, [params, aggregatedData]);
    } else {
      // The query has completed
      return aggregatedData;
    }
  }

  /*
   * describeTable()
   * Gets metadata about the table.
   * Used for "pinging" the table to measure latency and verify connectivity and configuration.
   */
  protected async describeTable(): Promise<string> {
    this.logger.trace("describeTable() called", null, this.constructor.name);

    const params: DescribeTableInput = {
      TableName: this.tableName
    };

    const result = await this.dynamodb.describeTable(params).promise();

    if (result.Table.TableStatus !== "ACTIVE") {
      throw new Error("DynamoDB table status is not in healthy state.");
    }

    return result.Table.TableStatus;
  }

  /*
   * transactionalWrite()
   * Executes multiple write operations within a single transaction.
   * If any one of the write operations fails, the transaction is aborted.
   */
  protected async transactionalWrite(entities: DynamoTransactionWriteItem[]): Promise<DynamoTransactionWriteItem[]> {
    this.logger.trace("transactionalWrite() called", { entities }, this.constructor.name);

    const params: TransactWriteItemsInput = {
      TransactItems: []
    };

    for (const i in entities) {
      const operation = entities[i].operation;
      switch (operation) {
        case BaseDynamoRepository.PUT: {
          params.TransactItems.push({
            Put: {
              TableName: this.tableName,
              Item: entities[i].record
            }
          });
          break;
        }
        case BaseDynamoRepository.UPDATE: {
          params.TransactItems.push({
            Update: this.generateUpdateParams(entities[i].record) as DynamoDB.Update
          });
          break;
        }
        case BaseDynamoRepository.DELETE: {
          params.TransactItems.push({
            Delete: {
              TableName: this.tableName,
              Key: this.generatePrimaryKey(entities[i].partitionKeyValue, entities[i].sortKeyValue)
            }
          });
          break;
        }
      }
    }

    await this.documentClient.transactWrite(params).promise();
    return entities;
  }
}
