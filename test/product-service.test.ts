import { main as getProductsList } from "../lib/product-service-stack/getProductsList";
import { main as getProductsById } from "../lib/product-service-stack/getProductsById";
import { products } from "../lib/product-service-stack/mockProducts";

jest.mock("../lib/product-service-stack/mockProducts", () => ({
  products: [
    {
      id: "id-1",
      title: "Product A",
      description: "Description A",
      price: 10.0,
    },
    {
      id: "id-2",
      title: "Product B",
      description: "Description B",
      price: 20.0,
    },
  ],
}));

describe("getProductsList", () => {
  it("returns all products as an array", async () => {
    const result = await getProductsList();

    expect(result).toEqual([...products]);
  });

  it("returns an array with the correct number of products", async () => {
    const result = await getProductsList();

    expect(result).toHaveLength(2);
  });
});

describe("getProductsById", () => {
  it("returns the matching product as a flat object", async () => {
    const result = await getProductsById({ id: "id-1" });

    expect(result).toEqual({ ...products[0] });
  });

  it("returns a different product when a different id is provided", async () => {
    const result = await getProductsById({ id: "id-2" });

    expect(result).toEqual({ ...products[1] });
  });

  it("throws a [NotFound] error when the product does not exist", async () => {
    await expect(getProductsById({ id: "non-existent-id" })).rejects.toThrow(
      JSON.stringify({
        type: "[NotFound]",
        message: "Product with id non-existent-id not found",
      }),
    );
  });
});
