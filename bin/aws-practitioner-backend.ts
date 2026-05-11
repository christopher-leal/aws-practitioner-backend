#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ProductServiceStack } from "../lib/product-service-stack/product-service-stack";
import { ImportServiceStack } from "../lib/product-service-stack/import-service-stack";
import { ProductSqsStack } from "../lib/product-sqs/product-sqs-stack";
import { ProductSnsStack } from "../lib/product-sns/product-sns-stack";
import { AuthorizerStack } from "../lib/authorizer-stack/authorizer-stack";

const app = new cdk.App();

const productStack = new ProductServiceStack(app, "ProductServiceStack", {});

new ImportServiceStack(app, "ImportServiceStack", {
  catalogItemsQueue: productStack.catalogItemsQueue,
});

new ProductSqsStack(app, "ProductSqsStack");

new ProductSnsStack(app, "ProductSnsStack");

new AuthorizerStack(app, "AuthorizerStack");
