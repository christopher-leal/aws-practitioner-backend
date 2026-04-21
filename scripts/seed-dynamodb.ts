/**
 * DynamoDB Seed Script
 *
 * Populates the products and stock DynamoDB tables with test data.
 *
 * Usage:
 *   npm run seed
 *
 * Environment variables:
 *   AWS_REGION           - AWS region (default: us-east-1)
 *   PRODUCTS_TABLE_NAME  - Products table name (default: products)
 *   STOCK_TABLE_NAME     - Stock table name (default: stock)
 *
 * You can set these in a .env file (never commit it):
 *   AWS_REGION=us-east-1
 *   PRODUCTS_TABLE_NAME=products
 *   STOCK_TABLE_NAME=stock
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE_NAME ?? "products";
const STOCK_TABLE = process.env.STOCK_TABLE_NAME ?? "stock";

const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const seedProducts = [
  {
    id: "6023a861-92ec-430d-81a9-d66dc8e5f8ca",
    title: "Wireless Noise-Cancelling Headphones",
    description:
      "Over-ear headphones with active noise cancellation and 30-hour battery life.",
    price: 299,
  },
  {
    id: "d2a69d18-59f7-4ae3-80a5-6b45843db835",
    title: "Mechanical Keyboard",
    description:
      "Tenkeyless mechanical keyboard with Cherry MX switches and RGB backlight.",
    price: 129,
  },
  {
    id: "6881fb46-3b6f-4599-a276-5273ad14f062",
    title: "USB-C Hub",
    description:
      "7-in-1 hub with HDMI, USB 3.0, SD card reader, and 100W PD charging.",
    price: 49,
  },
  {
    id: "364e1d23-9154-41ff-a4b4-3a08ee050ef8",
    title: "Webcam 4K",
    description:
      "4K Ultra HD webcam with auto-focus and built-in noise-cancelling microphone.",
    price: 199,
  },
  {
    id: "6b0e6e10-23bb-4cb6-b280-2e04e25d0c9e",
    title: "Laptop Stand",
    description:
      "Adjustable aluminum laptop stand compatible with 10-17 inch laptops.",
    price: 39,
  },
];

const seedStock = seedProducts.map((product, index) => ({
  product_id: product.id,
  count: (index + 1) * 10,
}));

async function seed() {
  console.log(`Seeding table "${PRODUCTS_TABLE}" in region ${REGION}...`);

  for (const product of seedProducts) {
    await docClient.send(
      new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }),
    );
    console.log(`  Inserted product: ${product.title} (${product.id})`);
  }

  console.log(`\nSeeding table "${STOCK_TABLE}"...`);

  for (const stock of seedStock) {
    await docClient.send(
      new PutCommand({ TableName: STOCK_TABLE, Item: stock }),
    );
    console.log(
      `  Inserted stock: product_id=${stock.product_id}, count=${stock.count}`,
    );
  }

  console.log("\nSeed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
