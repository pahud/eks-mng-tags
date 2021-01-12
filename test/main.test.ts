import '@aws-cdk/assert/jest';
import { App } from '@aws-cdk/core';
import { MyStack } from '../src/main';

test('Snapshot', () => {
  const app = new App({
    context: {
      use_vpc_id: 'mock',
    }
  });

  const devEnv = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  };
  const stack = new MyStack(app, 'my-stack', { env: devEnv })
  expect(app.synth().getStackArtifact(stack.artifactId).template).toMatchSnapshot();
});
