import { SNSEvent } from "aws-lambda";

export function main(event: SNSEvent) {
  console.log("Received message:", event.Records[0].Sns.Message);
}