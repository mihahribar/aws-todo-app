import { EventBridgeEvent } from "aws-lambda";

interface todoItem {
  todoId: string;
  name: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export const handler = async function (
  event: EventBridgeEvent<"TodoDeleted", todoItem>
): Promise<void> {
  console.log(`Todo ${event.detail.todoId} deleted`, event);
};