/* globals describe */
/* globals it */
/* globals beforeEach */
/* globals afterEach */

const expect = require('chai').expect;
const sinon = require('sinon');

const RollbarAPI = require('../../src/common/rollbar-api');
const Output = require('../../src/common/output');

describe('RollbarAPI()', function() {
  it('should initialize successfully', function() {
    const accessToken = 'abcd';
    const rollbarAPI = new RollbarAPI(accessToken);

    expect(rollbarAPI.accessToken).to.equal(accessToken);
    expect(rollbarAPI.axios).to.have.property('post');
  });
});

describe('.sourcemaps()', function() {
  beforeEach(function(done) {
    const accessToken = 'abcd';
    this.currentTest.rollbarAPI = new RollbarAPI(accessToken);
    global.output = new Output({verbose: true});

    this.currentTest.stub = sinon.stub(this.currentTest.rollbarAPI.axios, 'post');

    done();
  });

  afterEach(function() {
    global.output = null;
    this.currentTest.stub.restore();
  });

  it('should send well formed request', async function() {
    const rollbarAPI = this.test.rollbarAPI;
    const stub = this.test.stub;

    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { err: 0, result: { uuid: 'd4c7acef55bf4c9ea95e4fe9428a8287'}}
    });

    const request = {
      version: '123',
      minified_url: 'https://example.com/foo.js',
      source_map: '{ \
        "version" : 3, \
        "file": "out.js", \
        "sourceRoot": "", \
        "sources": ["foo.js", "bar.js"], \
        "sourcesContent": [null, null], \
        "names": ["src", "maps", "are", "fun"], \
        "mappings": "A,AAAB;;ABCDE;" \
        }',
      sources: []
    };

    const response = await rollbarAPI.sourcemaps(request);

    expect(response).to.be.null;
    expect(stub.calledOnce).to.be.true;

    const body = stub.getCall(0).args;
    expect(body[0]).to.equal('/sourcemap');
    expect(body[1]).to.be.a('Uint8Array'); // This is how Chai sees the Buffer type
    expect(body[2].headers['Content-Type']).to.have.string('multipart/form-data; boundary=--------------------------');
    expect(body[2].headers['Content-Length']).to.equal(726);
  });

  it('should handle error responses', async function() {
    const rollbarAPI = this.test.rollbarAPI;
    const stub = this.test.stub;

    stub.resolves({
      status: 401,
      statusText: 'Unauthorized',
      data: { err: 1, message: 'invalid access token'}
    });

    const request = {
      version: '123',
      minified_url: 'https://example.com/foo.js',
      source_map: '{}',
      sources: []
    };

    const response = await rollbarAPI.sourcemaps(request);

    expect(response.err).to.equal(1);
    expect(response.message).to.equal('invalid access token');
    expect(stub.calledOnce).to.be.true;
  });
});

describe('.deploy() without deployId', function() {
  beforeEach(function(done) {
    const accessToken = 'abcd';
    this.currentTest.rollbarAPI = new RollbarAPI(accessToken);
    global.output = new Output({verbose: true});

    this.currentTest.stub = sinon.stub(this.currentTest.rollbarAPI.axios, 'post');
    done();
  });

  afterEach(function() {
    global.output = null;
    this.currentTest.stub.restore();
  });

  it('should handle basic deploy request', async function() {
    const rollbarAPI = this.test.rollbarAPI;
    const stub = this.test.stub;

    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { deploy_id: 12345678 }
    });

    const request = {
      revision: '123',
      environment: 'production',
      status: '',
      rollbar_username: '',
      local_username: '',
      comment: ''
    };

    const deployId = '';

    const response = await rollbarAPI.deploy(request, deployId);

    expect(response).to.be.null;
    expect(stub.calledOnce).to.be.true;

    const body = stub.getCall(0).args;
    expect(body[0]).to.equal('/deploy');
    expect(body[1]).to.be.a('Uint8Array'); // This is how Chai sees the Buffer type
    expect(body[2].headers['Content-Type']).to.have.string('multipart/form-data; boundary=--------------------------');
    expect(body[2].headers['Content-Length']).to.equal(286);
  });

  it('should handle pre-deploy', async function() {
    const rollbarAPI = this.test.rollbarAPI;
    const stub = this.test.stub;

    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { deploy_id: 12345678 }
    });

    const request = {
      revision: '123',
      environment: 'production',
      status: 'started',
      rollbar_username: 'foobar',
      local_username: 'foo_bar',
      comment: 'Deploy Test'
    };

    const deployId = '';

    const response = await rollbarAPI.deploy(request, deployId);

    expect(response).to.be.null;
    expect(stub.calledOnce).to.be.true;

    const body = stub.getCall(0).args;
    expect(body[0]).to.equal('/deploy');
    expect(body[1]).to.be.a('Uint8Array'); // This is how Chai sees the Buffer type
    expect(body[2].headers['Content-Type']).to.have.string('multipart/form-data; boundary=--------------------------');
    expect(body[2].headers['Content-Length']).to.equal(756);
  });

  it('should handle deploy error response', async function() {
    const rollbarAPI = this.test.rollbarAPI;
    const stub = this.test.stub;

    stub.resolves({
      status: 422,
      statusText: 'Unprocessable Entity',
      data: { err: 1, message: 'Missing \'environment\' key. Missing \'revision\' or \'head_long\' key. \'environment\' key must be a string.' }
    });

    const request = {
      revision: '',
      environment: '',
      status: '',
      rollbar_username: '',
      local_username: '',
      comment: ''
    };

    const deployId = '';

    const response = await rollbarAPI.deploy(request, deployId);

    expect(response.err).to.equal(1);
    expect(response.message).to.equal('Missing \'environment\' key. Missing \'revision\' or \'head_long\' key. \'environment\' key must be a string.');
    expect(stub.calledOnce).to.be.true;
  });
});

describe('.deploy() with deployId', function() {
  beforeEach(function(done) {
    const accessToken = 'abcd';
    this.currentTest.rollbarAPI = new RollbarAPI(accessToken);
    global.output = new Output({verbose: true});

    this.currentTest.stub = sinon.stub(this.currentTest.rollbarAPI.axios, 'patch');
    done();
  });

  afterEach(function() {
    global.output = null;
    this.currentTest.stub.restore();
  });

  it('should handle post-deploy', async function() {
    const rollbarAPI = this.test.rollbarAPI;
    const stub = this.test.stub;

    stub.resolves({
      status: 200,
      statusText: 'Success',
      data: { deploy_id: 12345678 }
    });

    const request = {
      revision: '123',
      environment: 'production',
      status: 'succeeded',
      rollbar_username: 'foobar',
      local_username: 'foo_bar',
      comment: 'comment'
    };

    const deployId = '12345678';

    const response = await rollbarAPI.deploy(request, deployId);

    expect(response).to.be.null;
    expect(stub.calledOnce).to.be.true;

    const body = stub.getCall(0).args;
    expect(body[0]).to.equal('/deploy/12345678');
    expect(body[1]).to.be.a('Uint8Array'); // This is how Chai sees the Buffer type
    expect(body[2].headers['Content-Type']).to.have.string('multipart/form-data; boundary=--------------------------');
    expect(body[2].headers['Content-Length']).to.equal(754);
  });
});

