import { EventBridgeEvent } from "aws-lambda";

interface todoItem {
  todoId: string;
  name: string;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export const handler = async function (
  event: EventBridgeEvent<"TodoCreated", todoItem>
): Promise<void> {
  console.log(`Todo ${event.detail.todoId} created`, event);
};