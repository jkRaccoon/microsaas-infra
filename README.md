# microsaas-infra

Shared AWS CDK construct library + bootstrap stack for the personal micro-SaaS portfolio hosted on `bal.pe.kr` subdomains.

## What's in here

- `src/static-site.ts` — `MicroSaasStaticSite` Construct: 한 번 호출로 S3(비공개, OAC) + CloudFront + ACM + Route53 A alias + 파일 배포까지 완성.
- `src/bootstrap-stack.ts` — 계정 단위로 한 번만 배포하는 스택. GitHub OIDC provider + 공통 deploy role(`microsaas-github-deploy`) 생성.
- `bin/bootstrap-app.ts` — 위 bootstrap 스택의 CDK 엔트리포인트.

## Usage

1. **최초 1회 bootstrap (raccoon 계정)**

   ```bash
   AWS_PROFILE=raccoon npx cdk bootstrap aws://778021795831/ap-northeast-2
   AWS_PROFILE=raccoon npx cdk bootstrap aws://778021795831/us-east-1
   AWS_PROFILE=raccoon npm run bootstrap:deploy
   ```

2. **각 툴 레포에서 사용**

   ```bash
   # 툴 레포에 git submodule 로 포함
   git submodule add git@github.com:jkRaccoon/microsaas-infra.git infra/microsaas-infra
   # infra/package.json 에 file 경로 의존성 추가
   # "microsaas-infra": "file:./microsaas-infra"
   ```

   ```ts
   import { MicroSaasStaticSite } from 'microsaas-infra';

   new MicroSaasStaticSite(this, 'Site', {
     subdomain: 'pogalwage',
     hostedZoneId: 'Z08710722R7QC38MUUSET',
     hostedZoneName: 'bal.pe.kr',
     certificate,   // must be in us-east-1
     sourcePath: '../dist',
   });
   ```

## Constraints

- 반드시 `AWS_PROFILE=raccoon` 사용. `default`(회사 계정) 절대 사용 금지.
- ACM 은 `us-east-1` 에 생성 (CloudFront 제약). App 에서 cross-region reference 로 처리.
- OIDC provider 는 **계정당 1개만** 존재 가능. Bootstrap 스택이 소유.
