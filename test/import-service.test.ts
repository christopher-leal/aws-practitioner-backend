// Mock the S3 client and presigner before importing the handler
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({})),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  };
});

const mockGetSignedUrl = jest.fn();
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mockGetSignedUrl,
}));

import { main, ImportEvent } from '../lib/product-service-stack/importProductsFile';

const makeEvent = (queryParams?: Record<string, string>): ImportEvent =>
  ({
    queryStringParameters: queryParams ?? undefined,
  });

beforeEach(() => {
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

    it('calls getSignedUrl with the uploaded/ key prefix', async () => {
      await main(makeEvent({ name: 'products.csv' }));

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
      const [, command] = mockGetSignedUrl.mock.calls[0];
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: 'uploaded/products.csv',
      });
    });

    it('returns a signed URL for any valid file name', async () => {
      mockGetSignedUrl.mockResolvedValue('https://signed-url.example.com/uploaded/other.csv');

      const result = await main(makeEvent({ name: 'other.csv' }));

      expect(result).toBe('https://signed-url.example.com/uploaded/other.csv');
      expect(mockGetSignedUrl.mock.calls[0][1].input.Key).toBe('uploaded/other.csv');
    });
  });
});
