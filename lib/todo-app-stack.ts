import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NodejsFunction, NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { RestApi, LambdaIntegration } from "aws-cdk-lib/aws-apigateway";
import { Table, AttributeType, BillingMode, StreamViewType } from "aws-cdk-lib/aws-dynamodb";
import { DynamoEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { StartingPosition } from "aws-cdk-lib/aws-lambda";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";

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
      stream: StreamViewType.NEW_AND_OLD_IMAGES,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    // SNS Topic
    const topic = new Topic(this, "TodoEventTopic");
    topic.addSubscription(new EmailSubscription("miha.hribar@1337.tech"));

    // EventBridge bus
    const bus = new EventBus(this, "TodoEventBus");

    const commonFunctionProps: NodejsFunctionProps = {
      handler: 'handler',
      runtime: Runtime.NODEJS_16_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(60),
      bundling: {
        minify: true,
      },
    }

    const apiFunctionProps: NodejsFunctionProps = {
      timeout: cdk.Duration.seconds(29),
      environment: {
        TABLE_NAME: table.tableName,
      }
    }

    // API Lambda Functions
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
        ...commonFunctionProps,
        ...apiFunctionProps
      })
    );

    // Stream Lambda
    const streamFunction = new NodejsFunction(this, "StreamFunction", {
      entry: "functions/stream/handler.ts",
      ...commonFunctionProps,
      environment: {
        EVENT_BUS_NAME: bus.eventBusName,
      },
    });
    streamFunction.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: StartingPosition.TRIM_HORIZON,
        batchSize: 10,
        retryAttempts: 3,
      })
    );
    bus.grantPutEventsTo(streamFunction);

    // EventBridge lambdas
    const todoCreatedFunction = new NodejsFunction(this, "TodoCreatedFunction", {
      entry: "functions/todoCreatedEvent/handler.ts",
      ...commonFunctionProps,
    });
    const todoCompletedFunction = new NodejsFunction(
      this,
      "TodoCompletedFunction",
      {
        entry: "functions/todoCompletedEvent/handler.ts",
        ...commonFunctionProps,
        environment: {
          TOPIC_ARN: topic.topicArn,
        }
      }
    );
    topic.grantPublish(todoCompletedFunction);
    const todoDeletedFunction = new NodejsFunction(this, "TodoDeletedFunction", {
      entry: "functions/todoDeletedEvent/handler.ts",
      ...commonFunctionProps,
    });

    // EventBridge integrations
    new Rule(this, "TodoCreatedRule", {
      eventBus: bus,
      eventPattern: { detailType: ["TodoCreated"] },
      targets: [new LambdaFunction(todoCreatedFunction)],
    });
    new Rule(this, "TodoCompletedRule", {
      eventBus: bus,
      eventPattern: { detailType: ["TodoCompleted"] },
      targets: [new LambdaFunction(todoCompletedFunction)],
    });
    new Rule(this, "TodoDeletedRule", {
      eventBus: bus,
      eventPattern: { detailType: ["TodoDeleted"] },
      targets: [new LambdaFunction(todoDeletedFunction)],
    });

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
