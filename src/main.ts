import { App, Construct, Stack, StackProps, Fn } from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';

/**
 * Props for VpcPeering
 */
export interface VpcPeeringProps {
  /**
   * The existing VPC
   */
  readonly vpc: ec2.IVpc;
  /**
   * The new peer VPC
   */
  readonly peerVpc: ec2.IVpc;
}

/**
 * Create VPC peering connection from `vpc` to `peerVpc`
 */
export class VpcPeering extends Construct {
  readonly peeringConnection: ec2.CfnVPCPeeringConnection
  constructor(scope: Construct, id: string, props: VpcPeeringProps) {
    super(scope, id)

    const peeringConnection = new ec2.CfnVPCPeeringConnection(this, 'VpcPeeringConnection', {
      vpcId: props.vpc.vpcId,
      peerVpcId: props.peerVpc.vpcId
    })
    this.peeringConnection = peeringConnection
  }
}


export interface EksDemoProps {
  /**
   * vpc for the eks cluster
   */
  readonly vpc?: ec2.IVpc;
}

export class EksDemo extends Construct {
  constructor(scope: Construct, id: string, props: EksDemoProps) {
    super(scope, id)

    const mastersRole = new iam.Role(this, 'MasterRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      roleName: 'EksAdminRole',
    });

    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc: props.vpc ?? getOrCreateVpc(this),
      mastersRole,
      version: eks.KubernetesVersion.V1_18,
      defaultCapacity: 0,
    })

    // Conditionally add aws console login user to the RBAC so we can browse the EKS workloads
    const consoleUserString = this.node.tryGetContext('console_user')
    if (consoleUserString) {
      const consoleUser = iam.User.fromUserName(this, 'ConsoleUser', consoleUserString)
      cluster.awsAuth.addUserMapping(consoleUser, {
        groups: ['system:masters'],
      })
    }

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -o xtrace',
      `/etc/eks/bootstrap.sh ${cluster.clusterName}`,
    );
    const lt = new ec2.CfnLaunchTemplate(this, 'LaunchTemplate', {
      launchTemplateData: {
        imageId: new eks.EksOptimizedImage({
          kubernetesVersion: eks.KubernetesVersion.V1_18.version,
        }).getImage(this).imageId,
        instanceType: new ec2.InstanceType('t3.small').toString(),
        userData: Fn.base64(userData.render()),
        tagSpecifications: [
          {
            resourceType: 'instance',
            tags: [
              { key: 'Name', value: 'MNG'},
              { key: 'Foo', value: 'BAR' },
            ]
          }
        ]
      },
    });
    cluster.addNodegroupCapacity('extra-ng', {
      launchTemplateSpec: {
        id: lt.ref,
        version: lt.attrDefaultVersionNumber,
      },
      desiredSize: 2,
    });
  }
}

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    if (this.node.tryGetContext('use_vpc_id') === undefined) {
      throw new Error('ERROR - specify your existing vpc with `-c use_vpc_id=<VPC_ID>`')
    }
    // prepare existing Vpc
    const existingVpc = ec2.Vpc.fromLookup(this, 'Vpc', { vpcId: this.node.tryGetContext('use_vpc_id') })
    // create new vpc
    const newVpc = new ec2.Vpc(this, 'NewVpc', {
      natGateways: 1,
      cidr: '10.1.0.0/16',
    })
    // create the peering for the two Vpcs
    new VpcPeering(this, 'Peering', {
      vpc: existingVpc,
      peerVpc: newVpc,
    })

    // let's create the EKS cluster in the new Vpc
    new EksDemo(this, 'EksDemo', {
      vpc: newVpc,
    })

  }
}

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new Stack(app, 'my-stack-dev', { env: devEnv });

app.synth();

// helper function to create or use existing Vpc
function getOrCreateVpc(scope: Construct): ec2.IVpc {
  // use an existing vpc or create a new one
  return scope.node.tryGetContext('use_default_vpc') === '1' ?
    ec2.Vpc.fromLookup(scope, 'Vpc', { isDefault: true }) :
    scope.node.tryGetContext('use_vpc_id') ?
      ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId: scope.node.tryGetContext('use_vpc_id') }) :
      new ec2.Vpc(scope, 'Vpc', { maxAzs: 3, natGateways: 1 });
}
