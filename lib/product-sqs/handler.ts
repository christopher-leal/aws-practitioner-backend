import { SQSEvent } from "aws-lambda";

export function main(event: SQSEvent) {
  console.log("Received message:", event.Records[0].body);
}