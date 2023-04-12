import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { RestApi, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Table, AttributeType, BillingMode } from "aws-cdk-lib/aws-dynamodb";

export class TodoAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DynamoDB Table
    const table = new Table(this, "TodoTable", {
      partitionKey: {
        name: "todoId",
        type: AttributeType.STRING,
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
    });

    const commonFunctionProps: NodejsFunctionProps = {
      handler: 'handler',
      runtime: Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(29),
      environment: {
        TABLE_NAME: table.tableName,
      }
    }

    // Lambda Functions
    const lambdas = [
      ["GetTodoFunction", "functions/get_todo/handler.ts"],
      ["CreateTodoFunction", "functions/create_todo/handler.ts"],
      ["UpdateTodoFunction", "functions/update_todo/handler.ts"],
      ["DeleteTodoFunction", "functions/delete_todo/handler.ts"],
      ["ListTodoFunction", "functions/list_todos/handler.ts"],
    ];
    const [getFunction, createFunction, updateFunction, deleteFunction, listFunction] = lambdas.map(([name, handler]) => new NodejsFunction(
      this, 
      name, 
      {
        entry: handler,
        ...commonFunctionProps
      })
    );

    // REST API
    const restApi = new RestApi(this, "RestApi", {});
    const todos = restApi.root.addResource("todos");
    todos.addMethod("GET", new LambdaIntegration(listFunction));
    todos.addMethod("POST", new LambdaIntegration(createFunction));
    const todo = todos.addResource("{todoId}");
    todo.addMethod("GET", new LambdaIntegration(getFunction));
    todo.addMethod("PATCH", new LambdaIntegration(updateFunction));
    todo.addMethod("DELETE", new LambdaIntegration(deleteFunction));

    // Add Lambda runtime permissions
    table.grantReadData(getFunction);
    table.grantReadData(listFunction);
    table.grantWriteData(createFunction);
    table.grantWriteData(updateFunction);
    table.grantWriteData(deleteFunction);
  }
}
