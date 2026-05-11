import * as path from "path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SnsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as sns from "aws-cdk-lib/aws-sns";

const lambdaPath = path.join(__dirname, "../../dist/lib/product-sns");

export class ProductSnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productTopic = new sns.Topic(this, "product-topic");

    const lambdaFunction = new lambda.Function(this, "sns-lambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 1024,
      timeout: cdk.Duration.seconds(5),
      handler: "handler.main",
      code: lambda.Code.fromAsset(lambdaPath),
    });

    lambdaFunction.addEventSource(new SnsEventSource(productTopic));
  }
}