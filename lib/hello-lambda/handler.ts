export async function main(event: any) {
  return {
    message: `SUCCESS with message ${event.message} 🎉`,
  };
}
