import { App, Construct, Stack, Fn } from '@aws-cdk/core';
import * as eks from '@aws-cdk/aws-eks';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as iam from '@aws-cdk/aws-iam';

export class Demo extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id)

    const mastersRole = new iam.Role(this, 'MasterRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      roleName: 'EksAdminRole',
    });

    const cluster = new eks.Cluster(this, 'Cluster', {
      vpc: getOrCreateVpc(this),
      mastersRole,
      version: eks.KubernetesVersion.V1_18,
      defaultCapacity: 0,
    })

    // Conditionally add aws console login user to the RBAC so we can browse the EKS workloads
    const consoleUserString = this.node.tryGetContext('console_user')
    if (consoleUserString !== undefined) {
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
        imageId: new eks.EksOptimizedImage().getImage(this).imageId,
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

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

const stack = new Stack(app, 'my-stack-dev', { env: devEnv });

new Demo(stack, 'Demo')

app.synth();


function getOrCreateVpc(scope: Construct): ec2.IVpc {
  // use an existing vpc or create a new one
  return scope.node.tryGetContext('use_default_vpc') === '1' ?
    ec2.Vpc.fromLookup(scope, 'Vpc', { isDefault: true }) :
    scope.node.tryGetContext('use_vpc_id') ?
      ec2.Vpc.fromLookup(scope, 'Vpc', { vpcId: scope.node.tryGetContext('use_vpc_id') }) :
      new ec2.Vpc(scope, 'Vpc', { maxAzs: 3, natGateways: 1 });
}
