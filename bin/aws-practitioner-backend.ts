#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { ProductServiceStack } from "../lib/product-service-stack/product-service-stack";
import { ImportServiceStack } from "../lib/product-service-stack/import-service-stack";

const app = new cdk.App();

new ProductServiceStack(app, "ProductServiceStack", {});

new ImportServiceStack(app, "ImportServiceStack", {});
