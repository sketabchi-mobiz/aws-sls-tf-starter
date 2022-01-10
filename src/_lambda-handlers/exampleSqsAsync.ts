import { SQSEvent, SQSRecord } from "aws-lambda";
import { container } from "../config/ioc.container";
import { ExampleSqsMessage } from "../models/exampleSqsMessage.model";
import { LoggerService } from "../services/common/logger.service";
import { ExampleDataService } from "../services/exampleData.service";

// During container warm-up, resolve the dependencies once
// so these can be reused for each invocation of the handler
const exampleDataService: ExampleDataService = container.get(ExampleDataService);
const loggerService: LoggerService = container.get(LoggerService);

// This handler will be invoked each time the Lambda function is invoked
export const handler = async (event: SQSEvent): Promise<void> => {
  loggerService.info(`Received SQS Message. Input Records: ${event.Records.length}`, null, "exampleSqsAsync handler");

  // Marshall the appMessages (could be multiple messages batched together) out of the SQSEvent
  const eventRecords: SQSRecord[] = event.Records;
  const appMessages: ExampleSqsMessage[] = eventRecords.map((record) => JSON.parse(record.body));

  // Log the id and receive count for each message
  eventRecords.map((record) => {
    loggerService.info(
      "Message Metadata",
      {
        messageId: record.messageId,
        ApproximateReceiveCount: record.attributes.ApproximateReceiveCount
      },
      "exampleSqsAsync handler"
    );
  });

  // Process each message
  const promises = appMessages.map(async (msg) => await exampleDataService.processSqsMessage(msg));
  const data = await Promise.all(promises);
  loggerService.info("SQSEvent has been processed.", data, "exampleSqsAsync handler");
  // SQS will apply retry rules if an error occurs,
  // so we intentionally do NOT use a try..catch block here
  // With this setup, if an one of the messages fails, then the whole batch will get repeated.
  // If you need to avoid having the batch repeated, then you need to either:
  // 1) Use a batch size of 1; OR
  // 2) Programmatically remove each successfully processed message from the Queue via the AWS SDK
};
