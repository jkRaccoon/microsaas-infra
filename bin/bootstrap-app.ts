#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { BootstrapStack } from '../src/bootstrap-stack';

const app = new cdk.App();

new BootstrapStack(app, 'MicroSaasBootstrap', {
  env: {
    account: '778021795831',
    region: 'ap-northeast-2',
  },
  githubOrg: 'jkRaccoon',
  description: 'GitHub OIDC provider + shared deploy role for jkRaccoon/* micro-SaaS repos',
});
