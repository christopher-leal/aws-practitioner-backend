import { products } from "./mockProducts";

export async function main(event: any) {
  const { id } = event;
  const product = products.find((p) => p.id === id);
  if (!product) {
    throw new Error(
      JSON.stringify({
        type: "[NotFound]",
        message: `Product with id ${id} not found`,
      }),
    );
  }

  return {
    ...product,
  };
}
