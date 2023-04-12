import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommandInput } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME = process.env.TABLE_NAME || "";
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async function (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  console.log(event);

  const limit = parseInt(event.queryStringParameters?.limit || "10");
  const nextToken = event.queryStringParameters?.next_token;

  const params: ScanCommandInput = {
    TableName: TABLE_NAME,
    Limit: limit
  };

  if (nextToken) {
    params.ExclusiveStartKey = decodeToken(nextToken);
  }

  const response = await client.send(new ScanCommand(params));

  const items = response.Items?.map((item) => {
    return {
      todoId: item.todoId.S,
      name: item.name.S,
      completed: item.completed.BOOL,
      createdAt: item.createdAt.N,
      updatedAt: item.updatedAt.N,
    }
  });

  let headers: Record<string, string> = {};
  if (response.LastEvaluatedKey) {
    headers["Link"] = `</todos?limit=${limit}&next_token=${encodeToken(response.LastEvaluatedKey)}>; rel="next"`;
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify(items),
    headers: headers
  };
};

const encodeToken = (token: any): string | undefined => {
  if (token === undefined) {
    return undefined;
  }

  return Buffer.from(JSON.stringify(token)).toString("base64");
}

const decodeToken = (encodedToken: string): any | undefined => {
  if (encodeToken === undefined) {
    return undefined;
  }

  return JSON.parse(Buffer.from(encodedToken, "base64").toString("ascii"));
}