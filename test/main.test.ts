import '@aws-cdk/assert/jest';
import { App, Stack } from '@aws-cdk/core';
import { MyStack } from '../src/main';

test('Snapshot', () => {
  const app = new App();
  const devEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };

  const stack = new MyStack(app, 'my-stack', { env: devEnv })
  expect(stack).not.toHaveResource('AWS::S3::Bucket');
  expect(app.synth().getStackArtifact(stack.artifactId).template).toMatchSnapshot();
});
