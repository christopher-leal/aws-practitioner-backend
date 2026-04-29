import { mockClient } from 'aws-sdk-client-mock';
import 'aws-sdk-client-mock-jest';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { main, ImportEvent, s3Client } from '../lib/product-service-stack/importProductsFile';

jest.mock('@aws-sdk/s3-request-presigner');

const s3Mock = mockClient(s3Client);
const mockGetSignedUrl = getSignedUrl as jest.MockedFunction<typeof getSignedUrl>;

const makeEvent = (queryParams?: Record<string, string>): ImportEvent =>
  ({
    queryStringParameters: queryParams ?? undefined,
  });

beforeEach(() => {
  s3Mock.reset();
  jest.clearAllMocks();
  process.env.BUCKET_NAME = 'test-bucket';
  process.env.AWS_REGION = 'us-east-1';
});

describe('importProductsFile', () => {
  describe('when "name" query param is missing', () => {
    it('throws an error with statusCode 400', async () => {
      await expect(main(makeEvent())).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining('"statusCode":400') }),
      );
    });

    it('does not call getSignedUrl', async () => {
      await expect(main(makeEvent())).rejects.toThrow();

      expect(mockGetSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('when "name" query param is provided', () => {
    beforeEach(() => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com/uploaded/products.csv');
    });

    it('returns the signed URL directly', async () => {
      const result = await main(makeEvent({ name: 'products.csv' }));

      expect(result).toBe('https://signed-url.example.com/uploaded/products.csv');
    });

    it('calls getSignedUrl with a PutObjectCommand for the uploaded/ key prefix', async () => {
      await main(makeEvent({ name: 'products.csv' }));

      const [, command] = mockGetSignedUrl.mock.calls[0];
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'uploaded/products.csv',
      });
    });

    it('calls getSignedUrl once', async () => {
      await main(makeEvent({ name: 'products.csv' }));

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });

    it('returns a signed URL for any valid file name', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com/uploaded/other.csv');

      const result = await main(makeEvent({ name: 'other.csv' }));

      expect(result).toBe('https://signed-url.example.com/uploaded/other.csv');
      const [, command] = mockGetSignedUrl.mock.calls[0];
      expect(command.input).toMatchObject({ Key: 'uploaded/other.csv' });
    });
  });
});
