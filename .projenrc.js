const { AwsCdkTypeScriptApp } = require('projen');

const project = new AwsCdkTypeScriptApp({
  cdkVersion: '1.83.0',
  name: 'eks-mng-tags',
  cdkDependencies: [
    '@aws-cdk/aws-eks',
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-iam',
  ],
  dependabot: false,
});

const common_exclude = ['cdk.out', 'cdk.context.json', 'images', 'yarn-error.log'];
project.npmignore.exclude(...common_exclude);
project.gitignore.exclude(...common_exclude);


project.synth();
