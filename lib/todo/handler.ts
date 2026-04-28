import { Handler } from "aws-lambda";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { randomUUID } from "crypto";

const dynamoDB = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TABLE_NAME as string;

export const addTodo: Handler = async (event, context) => {
  try {
    const command = new PutItemCommand({
      TableName: tableName,
      Item: {
        id: { S: randomUUID() },
        createdAt: { N: new Date().getTime().toFixed() },
        body: { S: event.todoBody },
      },
    });

    const result = await dynamoDB.send(command);

    console.log("PutItem succeeded:", JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error("Error:", error);
    throw new Error("Error adding item to DynamoDB table");
  }
};
