#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { HelloLambdaStack } from "../lib/hello-lambda/hello-lambda-stack";
import { ProductServiceStack } from "../lib/product-service-stack/product-service-stack";
import { TodoStack } from "../lib/todo/TodoStack";

const app = new cdk.App();

new HelloLambdaStack(app, "HelloLambdaStack", {});

new ProductServiceStack(app, "ProductServiceStack", {});

new TodoStack(app, "TodoStack");
