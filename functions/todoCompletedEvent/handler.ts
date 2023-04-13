import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { EventBridgeEvent } from "aws-lambda";

const TOPIC_ARN = process.env.TOPIC_ARN || "";
const snsClient = new SNSClient({});

interface todoItem {
  todoId: string;
  name: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export const handler = async function (
  event: EventBridgeEvent<"TodoCompleted", todoItem>
): Promise<void> {
  console.log(`Todo ${event.detail.todoId} completed`, event);

  await snsClient.send(
    new PublishCommand({
      TopicArn: TOPIC_ARN,
      Subject: "Todo item completed",
      Message: `Item "${event.detail.name}" was marked as completed.`,
    })
  );

  console.log("SNS notification sent");
};