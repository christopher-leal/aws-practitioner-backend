import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { Construct } from "constructs";

const lambdaPath = path.join(__dirname, "../../dist/lib/product-service-stack");

export class ProductServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const getProductsLambdaFunction = new lambda.Function(
      this,
      "getProductsList",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        handler: "getProductsList.main",
        code: lambda.Code.fromAsset(lambdaPath),
      },
    );
    const getProductsByIdLambdaFunction = new lambda.Function(
      this,
      "getProductsById",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        memorySize: 1024,
        timeout: cdk.Duration.seconds(5),
        handler: "getProductsById.main",
        code: lambda.Code.fromAsset(lambdaPath),
      },
    );

    const api = new apigateway.RestApi(this, "products-api", {
      restApiName: "Products Service",
      description: "This service serves products.",
    });

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
            statusCode: "404",
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
          statusCode: "404",
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
      allowMethods: ["GET"],
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
  }
}
