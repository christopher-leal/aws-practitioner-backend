import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import * as dotenv from "dotenv";

const lambdaPath = path.join(__dirname);
export class AuthorizerStack extends cdk.Stack {
  public readonly basicAuthorizerFunction: lambda.IFunction;
  public readonly userPool: cognito.UserPool;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Load credentials from .env file (never committed to git)
    const envConfig = dotenv.config();

    const envVars: Record<string, string> = {};
    if (envConfig.parsed) {
      for (const [key, value] of Object.entries(envConfig.parsed)) {
        // Lambda env var names cannot contain hyphens; replace with underscores
        envVars[key.replace(/-/g, "_")] = value;
      }
    }

    this.basicAuthorizerFunction = new NodejsFunction(this, "basicAuthorizer", {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(5),
      entry: path.join(lambdaPath, "basicAuthorizer.ts"),
      handler: "main",
      bundling: { forceDockerBundling: false },
      environment: envVars,
    });

    // ── Cognito User Pool ──────────────────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "cloudx-user-pool",
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: false,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const callbackUrls = [
      "https://d2i4ewulasiv4x.cloudfront.net/",
      "http://localhost:3000/",
    ];

    const appClient = this.userPool.addClient("WebAppClient", {
      userPoolClientName: "web-app-client",
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true, // allows id_token in URL for SPA testing
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.PHONE,
          cognito.OAuthScope.COGNITO_ADMIN,
        ],
        callbackUrls,
        logoutUrls: callbackUrls,
      },
    });

    const domain = this.userPool.addDomain("UserPoolDomain", {
      cognitoDomain: { domainPrefix: "cloudx-christopher-leal" },
    });
    // Use response_type=token (implicit flow) so id_token appears in the URL
    // hash after sign-in — the SPA reads it from window.location.hash.
    // domain.signInUrl() hardcodes response_type=code, so we build manually.
    const buildLoginUrl = (redirectUri: string) =>
      `${domain.baseUrl()}/login` +
      `?client_id=${appClient.userPoolClientId}` +
      `&response_type=token` +
      `&scope=openid+email+profile` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: appClient.userPoolClientId,
      description: "Cognito App Client ID",
    });

    new cdk.CfnOutput(this, "HostedUiLoginUrl", {
      value: buildLoginUrl(callbackUrls[0]),
      description:
        "Cognito Hosted UI Login URL (implicit flow) — id_token appears in URL hash after sign-in",
    });

    new cdk.CfnOutput(this, "HostedUiLoginUrlLocal", {
      value: buildLoginUrl(callbackUrls[1]),
      description: "Cognito Hosted UI Login URL for localhost development",
    });
  }
}
