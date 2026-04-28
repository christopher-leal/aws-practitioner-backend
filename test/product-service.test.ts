import { main as getProductsList } from "../lib/product-service-stack/getProductsList";
import { main as getProductsById } from "../lib/product-service-stack/getProductsById";

const mockProducts = [
  {
    id: "id-1",
    title: "Product A",
    description: "Description A",
    price: 10,
  },
  {
    id: "id-2",
    title: "Product B",
    description: "Description B",
    price: 20,
  },
];

const mockStock = [
  { product_id: "id-1", count: 5 },
  { product_id: "id-2", count: 3 },
];

jest.mock("../lib/product-service-stack/db/dynamodb-client", () => ({
  docClient: {
    send: jest.fn(),
  },
  PRODUCTS_TABLE: "products",
  STOCK_TABLE: "stock",
}));

import { docClient } from "../lib/product-service-stack/db/dynamodb-client";

const mockSend = docClient.send as jest.Mock;

beforeEach(() => {
  mockSend.mockReset();
});

describe("getProductsList", () => {
  beforeEach(() => {
    mockSend
      .mockResolvedValueOnce({ Items: mockProducts })
      .mockResolvedValueOnce({ Items: mockStock });
  });

  it("returns all products joined with stock as an array", async () => {
    const result = await getProductsList();

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "id-1",
      title: "Product A",
      count: 5,
    });
    expect(result[1]).toMatchObject({
      id: "id-2",
      title: "Product B",
      count: 3,
    });
  });

  it("returns an array with the correct number of products", async () => {
    const result = await getProductsList();

    expect(result).toHaveLength(2);
  });
});

describe("getProductsById", () => {
  it("returns the matching product joined with stock", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: mockProducts[0] })
      .mockResolvedValueOnce({ Item: mockStock[0] });

    const result = await getProductsById({ id: "id-1" });

    expect(result).toMatchObject({ ...mockProducts[0], count: 5 });
  });

  it("returns a different product when a different id is provided", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: mockProducts[1] })
      .mockResolvedValueOnce({ Item: mockStock[1] });

    const result = await getProductsById({ id: "id-2" });

    expect(result).toMatchObject({ ...mockProducts[1], count: 3 });
  });

  it("throws a [NotFound] error when the product does not exist", async () => {
    mockSend
      .mockResolvedValueOnce({ Item: undefined })
      .mockResolvedValueOnce({ Item: undefined });

    await expect(getProductsById({ id: "non-existent-id" })).rejects.toThrow(
      JSON.stringify({
        type: "[NotFound]",
        message: "Product with id non-existent-id not found",
      }),
    );
  });
});
