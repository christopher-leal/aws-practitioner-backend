import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdaNodejs from "aws-cdk-lib/aws-lambda-nodejs";
import { aws_apigateway as apigateway } from "aws-cdk-lib";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as path from "path";
import { Construct } from "constructs";

export class CartServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── VPC ───────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, "CartVpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    // ── Security Groups ───────────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, "CartLambdaSg", {
      vpc,
      description: "Security group for Cart Lambda function",
      allowAllOutbound: true,
    });

    const dbSg = new ec2.SecurityGroup(this, "CartDbSg", {
      vpc,
      description: "Security group for Cart RDS instance",
      allowAllOutbound: false,
    });

    dbSg.addIngressRule(
      lambdaSg,
      ec2.Port.tcp(5432),
      "Allow Lambda to connect to PostgreSQL",
    );

    // ── RDS PostgreSQL ─────────────────────────────────────────────────────────
    // Task 8.2: RDS Database Instance using aws-cdk-lib/aws-rds
    const dbInstance = new rds.DatabaseInstance(this, "CartDatabase", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      databaseName: "cartdb",
      credentials: rds.Credentials.fromGeneratedSecret("postgres"),
      multiAz: false,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      publiclyAccessible: false,
    });

    // ── Lambda Function ───────────────────────────────────────────────────────
    // Task 8.1: Lambda using aws-cdk-lib/aws-lambda-nodejs
    const cartApiRoot = path.join(__dirname, "../../../nodejs-aws-cart-api");
    const cartLambda = new lambdaNodejs.NodejsFunction(this, "CartLambda", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(cartApiRoot, "dist/lambda.js"),
      depsLockFilePath: path.join(cartApiRoot, "package-lock.json"),
      handler: "handler",
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      bundling: {
        externalModules: [
          "aws-sdk",
          "@nestjs/microservices",
          "@nestjs/websockets/socket-module",
          "cache-manager",
          "class-validator",
          "class-transformer",
        ],
        // All @nestjs/* packages must share one node_modules instance at runtime.
        // Bundling some (via esbuild) while externaling others causes DI token
        // mismatches (two copies of ModuleRef). Keep them all external + installed.
        nodeModules: [
          "pg",
          "typeorm",
          "reflect-metadata",
          "@nestjs/typeorm",
          "@nestjs/core",
          "@nestjs/common",
          "@nestjs/platform-express",
          "@nestjs/config",
          "@nestjs/passport",
          "@nestjs/jwt",
          "passport",
          "passport-http",
          "passport-jwt",
          "passport-local",
          "@aws-sdk/client-secrets-manager",
        ],
      },
      environment: {
        NODE_ENV: "production",
        DB_SSL: "true",
        DB_HOST: dbInstance.instanceEndpoint.hostname,
        DB_PORT: dbInstance.instanceEndpoint.port.toString(),
        DB_NAME: "cartdb",
        DB_SECRET_ARN: dbInstance.secret!.secretArn,
      },
    });

    // Grant Lambda permission to read the DB secret
    dbInstance.secret!.grantRead(cartLambda);

    // ── API Gateway ───────────────────────────────────────────────────────────
    // Task 8.1: API Gateway using aws-cdk-lib/aws-apigateway
    const api = new apigateway.RestApi(this, "CartApi", {
      restApiName: "Cart Service",
      description: "This service serves a NestJS Cart application.",
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(cartLambda);

    // Proxy all paths and methods to Lambda
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true,
    });

    // ── Outputs ───────────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "CartApiUrl", {
      value: api.url,
      description: "Cart API Gateway URL",
    });

    new cdk.CfnOutput(this, "CartDbEndpoint", {
      value: dbInstance.instanceEndpoint.hostname,
      description: "Cart RDS PostgreSQL endpoint",
    });

    new cdk.CfnOutput(this, "CartDbSecretArn", {
      value: dbInstance.secret!.secretArn,
      description: "Cart DB credentials secret ARN",
    });
  }
}
