import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log(event);

  const todoId = event.pathParameters?.todoId;

  if (todoId) {
    const item = await client.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          todoId,
        },
      })
    );

    if (item.Item) {
      const response = {
        todoId: item.Item.todoId,
        name: item.Item.name,
        completed: item.Item.completed,
        createdAt: item.Item.createdAt,
        updatedAt: item.Item.updatedAt,
      };
    
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      "error": `Todo item ${todoId} not found!`
    }),
  };
};