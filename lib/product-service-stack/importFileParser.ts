import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { S3Event } from 'aws-lambda';
import { Readable } from 'stream';
import csv from 'csv-parser';

export const s3Client = new S3Client({ region: process.env.AWS_REGION });

export const main = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

    console.log(`Processing file: s3://${bucket}/${key}`);

    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );

    await new Promise<void>((resolve, reject) => {
      const stream = response.Body as Readable;
      stream
        .pipe(csv())
        .on('data', (data: Record<string, string>) => {
          console.log('Parsed record:', JSON.stringify(data));
        })
        .on('error', reject)
        .on('end', resolve);
    });

    const parsedKey = key.replace('uploaded/', 'parsed/');

    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${key}`,
        Key: parsedKey,
      }),
    );

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );

    console.log(`Moved s3://${bucket}/${key} to s3://${bucket}/${parsedKey}`);
  }
};
