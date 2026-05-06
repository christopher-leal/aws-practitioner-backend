import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface ImportEvent {
  queryStringParameters?: {
    name?: string;
  };
}

export const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const main = async (event: ImportEvent) => {
  const BUCKET_NAME = process.env.BUCKET_NAME!;
  const fileName = event.queryStringParameters?.name;

  if (!fileName) {
    throw new Error(
      JSON.stringify({ statusCode: 400, message: 'Query parameter "name" is required' }),
    );
  }

  const key = `uploaded/${fileName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: 'text/csv',
  });

  const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return signedUrl;
};
