import { PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  docClient,
  PRODUCTS_TABLE,
  STOCK_TABLE,
} from "./db/dynamodb-client.js";
import { Product, Stock } from "./types/product.js";
import { randomUUID } from "crypto";

interface CreateProductBody {
  title: string;
  description?: string;
  price: number;
  count: number;
}

function isValidProductBody(body: unknown): body is CreateProductBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.title === "string" &&
    b.title.trim().length > 0 &&
    typeof b.price === "number" &&
    b.price >= 0 &&
    typeof b.count === "number" &&
    Number.isInteger(b.count) &&
    b.count >= 0
  );
}

export async function main(event: unknown) {
  console.log("createProduct invoked with body:", JSON.stringify(event));

  if (!isValidProductBody(event)) {
    throw new Error(
      JSON.stringify({
        statusCode: 400,
        message:
          "Invalid product data. Required: title (string), price (number >= 0), count (integer >= 0)",
      }),
    );
  }

  try {
    const id = randomUUID();
    const product: Product = {
      id,
      title: event.title.trim(),
      description: event.description ?? "",
      price: event.price,
    };
    const stock: Stock = {
      product_id: id,
      count: event.count,
    };

    await Promise.all([
      docClient.send(
        new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }),
      ),
      docClient.send(new PutCommand({ TableName: STOCK_TABLE, Item: stock })),
    ]);

    return { ...product, count: stock.count };
  } catch (err) {
    console.error("createProduct error:", err);
    throw new Error(
      JSON.stringify({
        statusCode: 500,
        message: "Internal server error",
      }),
    );
  }
}
