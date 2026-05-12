#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ProductServiceStack } from "../lib/product-service-stack/product-service-stack";
import { ImportServiceStack } from "../lib/product-service-stack/import-service-stack";
import { ProductSqsStack } from "../lib/product-sqs/product-sqs-stack";
import { ProductSnsStack } from "../lib/product-sns/product-sns-stack";
import { AuthorizerStack } from "../lib/authorizer-stack/authorizer-stack";

const app = new cdk.App();

const authorizerStack = new AuthorizerStack(app, "AuthorizerStack");

const productStack = new ProductServiceStack(app, "ProductServiceStack", {
  cognitoUserPool: authorizerStack.userPool,
});

new ImportServiceStack(app, "ImportServiceStack", {
  catalogItemsQueue: productStack.catalogItemsQueue,
  userPool: authorizerStack.userPool,
});

new ProductSqsStack(app, "ProductSqsStack");

new ProductSnsStack(app, "ProductSnsStack");
