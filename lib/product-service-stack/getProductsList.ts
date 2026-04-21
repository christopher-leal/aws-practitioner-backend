import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  docClient,
  PRODUCTS_TABLE,
  STOCK_TABLE,
} from "./db/dynamodb-client.js";
import { Product, ProductWithStock, Stock } from "./types/product.js";

export async function main() {
  console.log("getProductsList invoked");

  try {
    const [productsResult, stockResult] = await Promise.all([
      docClient.send(new ScanCommand({ TableName: PRODUCTS_TABLE })),
      docClient.send(new ScanCommand({ TableName: STOCK_TABLE })),
    ]);

    const products = (productsResult.Items ?? []) as Product[];
    const stockMap = new Map<string, number>(
      ((stockResult.Items ?? []) as Stock[]).map((s) => [
        s.product_id,
        s.count,
      ]),
    );

    const result: ProductWithStock[] = products.map((product) => ({
      ...product,
      count: stockMap.get(product.id) ?? 0,
    }));

    return result;
  } catch (err) {
    console.error("getProductsList error:", err);
    throw err;
  }
}
