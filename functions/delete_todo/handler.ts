import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log(event);

  const todoId = event.pathParameters?.todoId;

  if (todoId) {
    try {
      await client.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: {
            todoId,
          },
          ConditionExpression: "attribute_exists(todoId)",
        })
      );
      
      return {
        statusCode: 204,
        body: ""
      };
    } 
    catch (err: any) {
      if (!(err instanceof ConditionalCheckFailedException)) {
        throw err;
      }
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({
      "error": `Todo item ${todoId} not found!`
    }),
  };
};