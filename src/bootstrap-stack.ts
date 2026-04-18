import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface BootstrapStackProps extends cdk.StackProps {
  /** GitHub org/user (예: 'jkRaccoon') */
  readonly githubOrg: string;
  /** 공통 deploy role 이름 (기본 'microsaas-github-deploy') */
  readonly roleName?: string;
}

/**
 * 계정당 1회만 배포하는 부트스트랩 스택.
 * - GitHub Actions OIDC provider 등록
 * - 모든 {org}/* 레포가 assume 할 수 있는 공통 deploy role 생성
 */
export class BootstrapStack extends cdk.Stack {
  readonly roleArn: string;

  constructor(scope: Construct, id: string, props: BootstrapStackProps) {
    super(scope, id, props);

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    const role = new iam.Role(this, 'MicrosaasDeployRole', {
      roleName: props.roleName ?? 'microsaas-github-deploy',
      description: `GitHub Actions deploy role for ${props.githubOrg}/* micro-SaaS repos`,
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          },
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.githubOrg}/*:*`,
          },
        },
        'sts:AssumeRoleWithWebIdentity',
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('PowerUserAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('IAMFullAccess'),
      ],
      maxSessionDuration: cdk.Duration.hours(1),
    });

    this.roleArn = role.roleArn;

    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: role.roleArn,
      description: 'AWS_ROLE_ARN 으로 GitHub Actions secrets 에 등록',
      exportName: 'MicrosaasDeployRoleArn',
    });
  }
}
