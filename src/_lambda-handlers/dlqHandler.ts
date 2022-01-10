import { SQSEvent, SQSRecord } from "aws-lambda";
import { container } from "../config/ioc.container";
import { LoggerService } from "../services/common/logger.service";

// During container warm-up, resolve the dependencies once
// so these can be reused for each invocation of the handler
const loggerService: LoggerService = container.get(LoggerService);

// This handler will be invoked each time the Lambda function is invoked
export const handler = async (event: SQSEvent): Promise<void> => {
  loggerService.info(`Received SQS Message. Input Records: ${event.Records.length}`, null, "dlqHandler handler");

  // Log the complete message content (beware of sensitive data going into the logs)
  const eventRecords: SQSRecord[] = event.Records;
  eventRecords.map((record) => {
    loggerService.info("ERROR: Message unable to be processed!", record, "dlqHandler handler");
    // You may want to add some other alert mechanism here. Send this event to somewhere a human will be alerted about it.
    // All events that go through the Dead Letter Queue likely need some investigation.
  });
};
