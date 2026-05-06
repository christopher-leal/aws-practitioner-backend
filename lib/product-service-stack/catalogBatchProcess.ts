import { SQSEvent } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';
import { docClient, PRODUCTS_TABLE, STOCK_TABLE } from './db/dynamodb-client.js';

export const snsClient = new SNSClient({ region: process.env.AWS_REGION ?? 'us-east-1' });

interface ProductRecord {
  title: string;
  description?: string;
  price: number;
  count: number;
}

export const main = async (event: SQSEvent): Promise<void> => {
  for (const record of event.Records) {
    const body = JSON.parse(record.body) as ProductRecord;
    const { title, description = '', price, count } = body;

    const id = randomUUID();

    await Promise.all([
      docClient.send(
        new PutCommand({
          TableName: PRODUCTS_TABLE,
          Item: { id, title, description, price },
        }),
      ),
      docClient.send(
        new PutCommand({
          TableName: STOCK_TABLE,
          Item: { product_id: id, count },
        }),
      ),
    ]);

    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: 'Product Created',
        Message: JSON.stringify({ id, title, description, price, count }),
        MessageAttributes: {
          price: {
            DataType: 'Number',
            StringValue: String(price),
          },
        },
      }),
    );
  }
};
