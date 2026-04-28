import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  docClient,
  PRODUCTS_TABLE,
  STOCK_TABLE,
} from "./db/dynamodb-client.js";
import { Product, ProductWithStock, Stock } from "./types/product.js";

export async function main(event: { id: string }) {
  const { id } = event;
  console.log("getProductsById invoked with id:", id);

  try {
    const [productResult, stockResult] = await Promise.all([
      docClient.send(
        new GetCommand({ TableName: PRODUCTS_TABLE, Key: { id } }),
      ),
      docClient.send(
        new GetCommand({ TableName: STOCK_TABLE, Key: { product_id: id } }),
      ),
    ]);

    const product = productResult.Item as Product | undefined;

    if (!product) {
      throw new Error(
        JSON.stringify({
          type: "[NotFound]",
          message: `Product with id ${id} not found`,
        }),
      );
    }

    const stock = stockResult.Item as Stock | undefined;

    const result: ProductWithStock = {
      ...product,
      count: stock?.count ?? 0,
    };

    return result;
  } catch (err) {
    console.error("getProductsById error:", err);
    throw err;
  }
}
