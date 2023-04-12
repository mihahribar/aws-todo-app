import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ConditionalCheckFailedException, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log(event);

  const todoId = event.pathParameters?.todoId;

  if (todoId) {
    if (event.body == null) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          "error": `Body missing!`
        }),
      };
    }
    const data = JSON.parse(event.body);

    // name and/or completed must be set, or return error
    let updateQuery: string[] = [];
    let keys: Record<string, string> = {};
    let values: Record<string, any> = {};

    // add when todo was last updated
    updateQuery.push("#UA = :updatedAt");
    keys["#UA"] = "updatedAt"
    values[":updatedAt"] = new Date().getTime();

    if (data.name && typeof data.name == "string" && data.name.trim().length > 0) {
      updateQuery.push("#N = :name");
      keys["#N"] = "name";
      values[":name"] = data.name.trim();
    }
    if (data.completed != null && typeof data.completed == "boolean") {
      updateQuery.push("#C = :completed");
      keys["#C"] = "completed";
      values[":completed"] = data.completed;
    }

    if (values.length > 1) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          "error": `Nothing to update or invalid data sent to update item ${todoId}`
        }),
      };
    }

    try {
      await client.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          todoId
        },
        UpdateExpression: `set ${updateQuery.join(",")}`,
        ExpressionAttributeNames: keys,
        ExpressionAttributeValues: values
      }));

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