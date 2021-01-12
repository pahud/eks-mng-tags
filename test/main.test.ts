import '@aws-cdk/assert/jest';
import { App } from '@aws-cdk/core';
import { MyStack } from '../src/main';

test('Snapshot', () => {

  const devEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };

  const app = new App();

  const stack = new MyStack(app, 'my-stack-dev', { env: devEnv });

  app.synth();

  expect(app.synth().getStackArtifact(stack.artifactId).template).toMatchSnapshot();
});
