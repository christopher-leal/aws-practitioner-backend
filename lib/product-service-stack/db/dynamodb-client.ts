import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: process.env.AWS_REGION ?? "us-east-1",
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME ?? "products";
export const STOCK_TABLE = process.env.STOCK_TABLE_NAME ?? "stock";
