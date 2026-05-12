import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as snsSubscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

const lambdaPath = path.join(__dirname, "../../dist/lib/product-service-stack");

interface ProductServiceStackProps extends cdk.StackProps {
  cognitoUserPool?: cognito.IUserPool;
}

export class ProductServiceStack extends cdk.Stack {
  public readonly catalogItemsQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props?: ProductServiceStackProps) {
    super(scope, id, props);

    // DynamoDB Tables
    const productsTable = new dynamodb.Table(this, "ProductsTable", {
      tableName: "products",
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const stockTable = new dynamodb.Table(this, "StockTable", {
      tableName: "stock",
      partitionKey: { name: "product_id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const commonEnv = {
      PRODUCTS_TABLE_NAME: productsTable.tableName,
      STOCK_TABLE_NAME: stockTable.tableName,
    };

    // SQS Queue
    this.catalogItemsQueue = new sqs.Queue(this, "catalogItemsQueue", {
      queueName: "catalogItemsQueue",
      visibilityTimeout: cdk.Duration.seconds(30),
    });

    // SNS Topic
    const createProductTopic = new sns.Topic(this, "createProductTopic", {
      topicName: "createProductTopic",
    });

    // Primary subscription — products with price >= 100
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription("christopher_leal@epam.com", {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            greaterThanOrEqualTo: 100,
          }),
        },
      }),
    );

    // Secondary subscription — products with price < 100 (budget items)
    createProductTopic.addSubscription(
      new snsSubscriptions.EmailSubscription(
        "christopher_leal+budget@epam.com",
        {
          filterPolicy: {
            price: sns.SubscriptionFilter.numericFilter({
              lessThan: 100,
            }),
          },
        },
      ),
    );

    // catalogBatchProcess lambda
    const catalogBatchProcessLambda = new lambda.Function(
      this,
      "catalogBatchProcess",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(30),
        handler: "catalogBatchProcess.main",
        code: lambda.Code.fromAsset(lambdaPath),
        environment: {
          ...commonEnv,
          SNS_TOPIC_ARN: createProductTopic.topicArn,
        },
      },
    );

    productsTable.grantWriteData(catalogBatchProcessLambda);
    stockTable.grantWriteData(catalogBatchProcessLambda);
    createProductTopic.grantPublish(catalogBatchProcessLambda);

    catalogBatchProcessLambda.addEventSource(
      new SqsEventSource(this.catalogItemsQueue, { batchSize: 5 }),
    );

    new cdk.CfnOutput(this, "CatalogItemsQueueUrl", {
      value: this.catalogItemsQueue.queueUrl,
      description: "Catalog Items SQS Queue URL",
    });

    new cdk.CfnOutput(this, "CatalogItemsQueueArn", {
      value: this.catalogItemsQueue.queueArn,
      description: "Catalog Items SQS Queue ARN",
    });

    // Lambda Functions
    const getProductsLambdaFunction = new lambda.Function(
      this,
      "getProductsList",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        handler: "getProductsList.main",
        code: lambda.Code.fromAsset(lambdaPath),
        environment: commonEnv,
      },
    );

    const getProductsByIdLambdaFunction = new lambda.Function(
      this,
      "getProductsById",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        handler: "getProductsById.main",
        code: lambda.Code.fromAsset(lambdaPath),
        environment: commonEnv,
      },
    );

    const createProductLambdaFunction = new lambda.Function(
      this,
      "createProduct",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        handler: "createProduct.main",
        code: lambda.Code.fromAsset(lambdaPath),
        environment: commonEnv,
      },
    );

    // Grant DynamoDB permissions
    productsTable.grantReadData(getProductsLambdaFunction);
    stockTable.grantReadData(getProductsLambdaFunction);
    productsTable.grantReadData(getProductsByIdLambdaFunction);
    stockTable.grantReadData(getProductsByIdLambdaFunction);
    productsTable.grantWriteData(createProductLambdaFunction);
    stockTable.grantWriteData(createProductLambdaFunction);

    const api = new apigateway.RestApi(this, "products-api", {
      restApiName: "Products Service",
      description: "This service serves products.",
    });

    // Optional Cognito authorizer for getProductsList
    const cognitoAuthorizer = props?.cognitoUserPool
      ? new apigateway.CognitoUserPoolsAuthorizer(this, "CognitoAuthorizer", {
          authorizerName: "CognitoAuthorizer",
          cognitoUserPools: [props.cognitoUserPool],
          identitySource: "method.request.header.Authorization",
        })
      : undefined;

    const productsResource = api.root.addResource("products");

    // GET /products
    const getProductsListIntegration = new apigateway.LambdaIntegration(
      getProductsLambdaFunction,
      {
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
          {
            statusCode: "500",
            selectionPattern: "(\\n|.)+",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
        ],
        proxy: false,
      },
    );
    productsResource.addMethod("GET", getProductsListIntegration, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "500",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
      ...(cognitoAuthorizer && {
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }),
    });

    // POST /products
    const createProductIntegration = new apigateway.LambdaIntegration(
      createProductLambdaFunction,
      {
        proxy: false,
        integrationResponses: [
          {
            statusCode: "201",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
          {
            statusCode: "400",
            selectionPattern: '.*"statusCode":400.*',
            responseTemplates: {
              "application/json":
                "$util.parseJson($input.path('$.errorMessage')).message",
            },
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
          {
            statusCode: "500",
            selectionPattern: '.*"statusCode":500.*',
            responseTemplates: {
              "application/json":
                "$util.parseJson($input.path('$.errorMessage')).message",
            },
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
        ],
      },
    );
    productsResource.addMethod("POST", createProductIntegration, {
      methodResponses: [
        {
          statusCode: "201",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "400",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "500",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
    });

    productsResource.addCorsPreflight({
      allowOrigins: [
        "https://d2i4ewulasiv4x.cloudfront.net",
        "http://localhost:3000",
      ],
      allowMethods: ["GET", "POST"],
    });

    // GET /products/{id}
    const productByIdResource = productsResource.addResource("{id}");
    const getProductsByIdIntegration = new apigateway.LambdaIntegration(
      getProductsByIdLambdaFunction,
      {
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
          {
            selectionPattern: ".*[NotFound].*",
            statusCode: "404",
            responseTemplates: {
              "application/json": JSON.stringify({
                message:
                  "$util.parseJson($input.path('$.errorMessage')).message",
              }),
            },
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
        ],
        requestTemplates: {
          "application/json": `{
            "id": "$method.request.path.id"
          }`,
        },

        proxy: false,
      },
    );
    productByIdResource.addMethod("GET", getProductsByIdIntegration, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
        {
          statusCode: "404",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": true,
          },
        },
      ],
      requestParameters: {
        "method.request.path.id": true,
      },
    });
    productByIdResource.addCorsPreflight({
      allowOrigins: [
        "https://d2i4ewulasiv4x.cloudfront.net",
        "http://localhost:3000",
      ],
      allowMethods: ["GET"],
    });

    new cdk.CfnOutput(this, "ProductsApiUrl", {
      value: api.url ?? "Something went wrong with the deploy",
      description: "The URL of the products API Gateway",
    });

    new cdk.CfnOutput(this, "ProductsTableName", {
      value: productsTable.tableName,
      description: "Products DynamoDB table name",
    });

    new cdk.CfnOutput(this, "StockTableName", {
      value: stockTable.tableName,
      description: "Stock DynamoDB table name",
    });
  }
}
