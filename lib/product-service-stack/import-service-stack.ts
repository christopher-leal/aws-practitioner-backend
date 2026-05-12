import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3notifications from "aws-cdk-lib/aws-s3-notifications";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

interface ImportServiceStackProps extends cdk.StackProps {
  catalogItemsQueue: sqs.IQueue;
  userPool: cognito.IUserPool;
}

const handlersPath = path.join(__dirname);

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ImportServiceStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "ImportBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ["*"],
          allowedHeaders: ["*"],
        },
      ],
    });

    const importProductsFileLambda = new NodejsFunction(
      this,
      "importProductsFile",
      {
        runtime: Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(10),
        entry: path.join(handlersPath, "importProductsFile.ts"),
        handler: "main",
        bundling: { forceDockerBundling: false },
        environment: {
          BUCKET_NAME: bucket.bucketName,
        },
      },
    );

    bucket.grantPut(importProductsFileLambda);

    const importFileParserLambda = new NodejsFunction(
      this,
      "importFileParser",
      {
        runtime: Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(60),
        entry: path.join(handlersPath, "importFileParser.ts"),
        handler: "main",
        bundling: { forceDockerBundling: false },
        environment: {
          SQS_QUEUE_URL: props.catalogItemsQueue.queueUrl,
        },
      },
    );

    bucket.grantReadWrite(importFileParserLambda);
    props.catalogItemsQueue.grantSendMessages(importFileParserLambda);

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(importFileParserLambda),
      { prefix: "uploaded/" },
    );

    const api = new apigateway.RestApi(this, "import-api", {
      restApiName: "Import Service",
      description: "Handles CSV product imports via signed S3 URLs.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "CognitoAuthorizer",
      {
        authorizerName: "CognitoAuthorizer",
        cognitoUserPools: [props.userPool],
        identitySource: "method.request.header.Authorization",
      },
    );

    const importResource = api.root.addResource("import");
    importResource.addMethod(
      "GET",
      new apigateway.LambdaIntegration(importProductsFileLambda, {
        proxy: false,
        requestTemplates: {
          "application/json": JSON.stringify({
            queryStringParameters: {
              name: "$util.escapeJavaScript($input.params('name'))",
            },
          }),
        },
        integrationResponses: [
          {
            statusCode: "200",
            responseParameters: {
              "method.response.header.Access-Control-Allow-Origin": "'*'",
            },
          },
          {
            statusCode: "400",
            selectionPattern: '.*"statusCode":400.*',
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
      }),
      {
        requestParameters: {
          "method.request.querystring.name": true,
        },
        methodResponses: [
          {
            statusCode: "200",
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
        authorizer: cognitoAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    new cdk.CfnOutput(this, "ImportApiUrl", {
      value: api.url ?? "Something went wrong with the deploy",
      description: "The URL of the import API Gateway",
    });
  }
}
