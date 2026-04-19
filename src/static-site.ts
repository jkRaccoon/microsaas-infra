import { Construct } from 'constructs';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export interface MicroSaasStaticSiteProps {
  /** 서브도메인 이름. 예: 'pogalwage' -> pogalwage.bal.pe.kr. 미지정 시 APEX(루트) 도메인. */
  readonly subdomain?: string;
  /** 기존 Route53 호스팅 존 ID */
  readonly hostedZoneId: string;
  /** 호스팅 존 이름. 예: 'bal.pe.kr' */
  readonly hostedZoneName: string;
  /** us-east-1 에 있는 ACM 인증서 (CloudFront 요구) */
  readonly certificate: acm.ICertificate;
  /** CloudFront price class. 기본 PRICE_CLASS_200 (아시아+유럽) */
  readonly priceClass?: cloudfront.PriceClass;
  /** 정적 파일 디렉토리 경로 (있으면 BucketDeployment 자동 실행) */
  readonly sourcePath?: string;
  /** S3 버킷 삭제 시 객체까지 제거. 개인 프로젝트 기본 true */
  readonly autoDeleteObjects?: boolean;
  /**
   * Override the default URL-rewrite CloudFront Function body.
   * If provided, this replaces the default clean-URL rewrite entirely.
   * Must be a complete JS 2.0 `function handler(event) { ... }`.
   */
  readonly customRewriteFunctionCode?: string;
  /**
   * 기존에 이미 존재하는 CloudFront Origin Access Control 의 ID.
   * CloudFront OAC 계정 한도(100개)에 도달했을 때 공용 OAC 를 재사용하기 위함.
   * 지정하면 새 OAC 를 만들지 않고 import 해서 연결합니다.
   */
  readonly sharedOriginAccessControlId?: string;
}

/**
 * 한 번에 정적 사이트 + 도메인을 완성하는 Construct.
 * S3 (비공개, OAC) + CloudFront + Route53 A alias.
 * certificate 는 반드시 us-east-1 리전에 있어야 함.
 */
export class MicroSaasStaticSite extends Construct {
  readonly bucket: s3.Bucket;
  readonly distribution: cloudfront.Distribution;
  readonly domainName: string;

  constructor(scope: Construct, id: string, props: MicroSaasStaticSiteProps) {
    super(scope, id);

    const autoDelete = props.autoDeleteObjects ?? true;
    const fqdn = props.subdomain
      ? `${props.subdomain}.${props.hostedZoneName}`
      : props.hostedZoneName;
    this.domainName = fqdn;

    this.bucket = new s3.Bucket(this, 'SiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: autoDelete ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      autoDeleteObjects: autoDelete,
    });

    // URL rewrite: "/guide" -> "/guide/index.html", "/" -> "/index.html"
    // Allows pre-rendered sub-path HTML files to serve under clean URLs.
    const DEFAULT_REWRITE = `function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!/\\.[a-zA-Z0-9]+$/.test(uri)) {
    request.uri += '/index.html';
  }
  return request;
}`;

    const urlRewriteFn = new cloudfront.Function(this, 'UrlRewriteFn', {
      functionName: `${fqdn.replace(/\./g, '-')}-rewrite`,
      runtime: cloudfront.FunctionRuntime.JS_2_0,
      code: cloudfront.FunctionCode.fromInline(props.customRewriteFunctionCode ?? DEFAULT_REWRITE),
    });

    const s3Origin = props.sharedOriginAccessControlId
      ? origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl: cloudfront.S3OriginAccessControl.fromOriginAccessControlId(
            this,
            'SharedOAC',
            props.sharedOriginAccessControlId,
          ),
        })
      : origins.S3BucketOrigin.withOriginAccessControl(this.bucket);

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        compress: true,
        functionAssociations: [
          {
            function: urlRewriteFn,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      defaultRootObject: 'index.html',
      domainNames: [fqdn],
      certificate: props.certificate,
      priceClass: props.priceClass ?? cloudfront.PriceClass.PRICE_CLASS_200,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
      ],
      comment: `microsaas static site for ${fqdn}`,
    });

    const zone = route53.HostedZone.fromHostedZoneAttributes(this, 'Zone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName,
    });

    new route53.ARecord(this, 'Alias', {
      zone,
      recordName: props.subdomain,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(this.distribution)),
    });

    if (props.sourcePath) {
      new s3deploy.BucketDeployment(this, 'Deploy', {
        sources: [s3deploy.Source.asset(props.sourcePath)],
        destinationBucket: this.bucket,
        distribution: this.distribution,
        distributionPaths: ['/*'],
      });
    }
  }
}
