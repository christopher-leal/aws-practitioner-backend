import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";

export async function main(
  event: APIGatewayTokenAuthorizerEvent,
): Promise<APIGatewayAuthorizerResult> {
  console.log("basicAuthorizer event:", JSON.stringify(event));

  const authorizationToken = event.authorizationToken;

  if (!authorizationToken) {
    // 401 — no Authorization header
    throw new Error("Unauthorized");
  }

  try {
    const [scheme, encoded] = authorizationToken.split(" ");

    if (scheme.toLowerCase() !== "basic" || !encoded) {
      throw new Error("Unauthorized");
    }

    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    const colonIndex = decoded.indexOf(":");

    if (colonIndex === -1) {
      throw new Error("Unauthorized");
    }

    const username = decoded.substring(0, colonIndex);
    const password = decoded.substring(colonIndex + 1);

    // Lambda env var names cannot contain hyphens; replace with underscores
    const envKey = username.replace(/-/g, "_");
    const storedPassword = process.env[envKey];

    if (storedPassword !== undefined && storedPassword === password) {
      return generatePolicy(username, "Allow", event.methodArn);
    }

    // 403 — credentials invalid
    return generatePolicy(username, "Deny", event.methodArn);
  } catch (err) {
    // Re-throw plain strings/Unauthorized to get 401
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Unauthorized") {
      throw new Error("Unauthorized");
    }
    // Unexpected errors → 401
    throw new Error("Unauthorized");
  }
}

function generatePolicy(
  principalId: string,
  effect: "Allow" | "Deny",
  resource: string,
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}
