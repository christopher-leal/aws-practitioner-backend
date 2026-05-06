import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSEvent, SQSRecord } from 'aws-lambda';

jest.mock('../lib/product-service-stack/db/dynamodb-client', () => ({
  docClient: {
    send: jest.fn(),
  },
  PRODUCTS_TABLE: 'products',
  STOCK_TABLE: 'stock',
}));

import { main, snsClient } from '../lib/product-service-stack/catalogBatchProcess';
import { docClient } from '../lib/product-service-stack/db/dynamodb-client';

const snsMock = mockClient(snsClient);
const mockSend = docClient.send as jest.Mock;

const makeSqsRecord = (body: object, index = 0): SQSRecord => ({
  messageId: `msg-${index}`,
  receiptHandle: `receipt-${index}`,
  body: JSON.stringify(body),
  attributes: {
    ApproximateReceiveCount: '1',
    SentTimestamp: '1',
    SenderId: '1',
    ApproximateFirstReceiveTimestamp: '1',
  },
  messageAttributes: {},
  md5OfBody: '',
  eventSource: 'aws:sqs',
  eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:catalogItemsQueue',
  awsRegion: 'us-east-1',
});

const makeSqsEvent = (records: object[]): SQSEvent => ({
  Records: records.map((body, i) => makeSqsRecord(body, i)),
});

beforeEach(() => {
  snsMock.reset();
  mockSend.mockReset();
  process.env.SNS_TOPIC_ARN =
    'arn:aws:sns:us-east-1:123456789012:createProductTopic';
  snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });
  mockSend.mockResolvedValue({});
});

describe('catalogBatchProcess', () => {
  describe('single record', () => {
    it('creates a product entry in the products table', async () => {
      await main(
        makeSqsEvent([
          { title: 'Test Product', price: 50, count: 10, description: 'A test' },
        ]),
      );

      const productsCall = mockSend.mock.calls[0][0];
      expect(productsCall.input).toMatchObject({
        TableName: 'products',
        Item: expect.objectContaining({
          title: 'Test Product',
          price: 50,
          description: 'A test',
        }),
      });
    });

    it('creates a stock entry in the stock table', async () => {
      await main(
        makeSqsEvent([{ title: 'Test Product', price: 50, count: 10 }]),
      );

      const stockCall = mockSend.mock.calls[1][0];
      expect(stockCall.input).toMatchObject({
        TableName: 'stock',
        Item: expect.objectContaining({ count: 10 }),
      });
    });

    it('generates a UUID as product id', async () => {
      await main(
        makeSqsEvent([{ title: 'Test Product', price: 50, count: 10 }]),
      );

      const productsCall = mockSend.mock.calls[0][0];
      expect(productsCall.input.Item.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('uses the same id for product and stock entries', async () => {
      await main(
        makeSqsEvent([{ title: 'Test Product', price: 50, count: 10 }]),
      );

      const productId = mockSend.mock.calls[0][0].input.Item.id;
      const stockProductId = mockSend.mock.calls[1][0].input.Item.product_id;
      expect(productId).toBe(stockProductId);
    });

    it('defaults description to empty string when not provided', async () => {
      await main(
        makeSqsEvent([{ title: 'No Description', price: 15, count: 2 }]),
      );

      const productsCall = mockSend.mock.calls[0][0];
      expect(productsCall.input.Item.description).toBe('');
    });

    it('publishes to SNS after creating the product', async () => {
      await main(
        makeSqsEvent([{ title: 'Test Product', price: 75, count: 5 }]),
      );

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        TopicArn: 'arn:aws:sns:us-east-1:123456789012:createProductTopic',
        Subject: 'Product Created',
      });
    });

    it('includes price as a Number message attribute in the SNS publish', async () => {
      await main(
        makeSqsEvent([{ title: 'Expensive Product', price: 200, count: 1 }]),
      );

      expect(snsMock).toHaveReceivedCommandWith(PublishCommand, {
        MessageAttributes: {
          price: { DataType: 'Number', StringValue: '200' },
        },
      });
    });

    it('includes product data in the SNS message body', async () => {
      await main(
        makeSqsEvent([{ title: 'My Product', price: 50, count: 3 }]),
      );

      const publishInput = snsMock.calls()[0].args[0].input as {
        Message?: string;
      };
      const message = JSON.parse(publishInput.Message ?? '{}');
      expect(message).toMatchObject({ title: 'My Product', price: 50, count: 3 });
    });
  });

  describe('multiple records in batch', () => {
    it('creates DynamoDB entries for every record', async () => {
      await main(
        makeSqsEvent([
          { title: 'Product 1', price: 10, count: 5 },
          { title: 'Product 2', price: 20, count: 3 },
        ]),
      );

      // 2 products + 2 stocks = 4 DynamoDB calls
      expect(mockSend).toHaveBeenCalledTimes(4);
    });

    it('publishes one SNS event per SQS record', async () => {
      await main(
        makeSqsEvent([
          { title: 'Product 1', price: 10, count: 5 },
          { title: 'Product 2', price: 20, count: 3 },
        ]),
      );

      expect(snsMock).toHaveReceivedCommandTimes(PublishCommand, 2);
    });
  });
});
