  /* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');

const Deployer = require('../../src/deploy/deployer');
const Output = require('../../src/common/output');

describe('Deployer()', function() {
  it('should initialize successfully', function() {
    const options = {
      accessToken: 'abcd',
      codeVersion: '123',
      deployId: '12345678',
      environment: 'production',
      status: 'succeeded',
      rollbarUsername: 'foobar',
      localUsername: 'foo_bar',
      comment: 'Deploy Test'
    };
    const deployer = new Deployer(options);

    expect(deployer.version).to.equal(options.codeVersion);
    expect(deployer.deploy_id).to.equal(options.deployId);
    expect(deployer.environment).to.equal(options.environment);
    expect(deployer.status).to.equal(options.status);
    expect(deployer.rollbar_username).to.equal(options.rollbarUsername);
    expect(deployer.local_username).to.equal(options.localUsername);
    expect(deployer.comment).to.equal(options.comment);
    expect(deployer).to.have.property('rollbarAPI');
    expect(deployer.rollbarAPI.accessToken).to.equal(options.accessToken);
  });
});

describe('.deploy()', function() {
  beforeEach(function() {
    global.output = new Output({quiet: true});
  });

  it('should deploy successfully', async function() {
    const options = {
      accessToken: 'abcd',
      codeVersion: '123',
      environment: 'production'
    };
    const deployer = new Deployer(options);
    const stub = sinon.stub(deployer.rollbarAPI.axios, 'post');
    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { deploy_id: 12345678 }
    });

    await deployer.deploy();

    expect(stub.callCount).to.equal(1);

    stub.restore();
  });

  it('should handle and report API errors', async function() {
    const options = {
      accessToken: '',
      codeVersion: '123',
      environment: 'production'
    };

    const deployer = new Deployer(options);
    const stub = sinon.stub(deployer.rollbarAPI.axios, 'post');
    stub.resolves({
      status: 401,
      statusText: 'Unauthorized',
      data: { err: 1, message: 'invalid access token'}
    });

    await deployer.deploy();

    expect(stub.callCount).to.equal(1);

    stub.restore();
  });
});
