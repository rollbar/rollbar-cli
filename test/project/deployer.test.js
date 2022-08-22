/* globals describe */
/* globals it */
/* globals beforeEach */

const expect = require('chai').expect;
const sinon = require('sinon');

const Deployer = require('../../src/project/deployer');
const Output = require('../../src/common/output');

describe('Deployer()', function() {
  it('should initialize successfully', function() {
    const options = {
      accessToken: 'xxxxxxxxxxxxxxxxxxxx',
      name: 'TestProject'
    };
    const deployer = new Deployer(options);

    expect(deployer.name).to.equal(options.name);
    expect(deployer).to.have.property('rollbarAPI');
    expect(deployer.rollbarAPI.accessToken).to.equal(options.accessToken);
  });
});

describe('.createProject()', function() {
  beforeEach(function() {
    global.output = new Output({quiet: true});
  });

  it('should deploy successfully', async function() {
    const options = {
      accessToken: 'xxxxxxxxxxxxxxxxxxxx',
      name: 'TestProject',
    };
    const deployer = new Deployer(options);
    const stub = sinon.stub(deployer.rollbarAPI.axios, 'post');
    stub.resolves({
      "err": 0,
      "result": {
        "status": "enabled",
        "name": "TestProject",
        "date_modified": 1661194738,
        "account_id": 436103,
        "date_created": 1661194738,
        "id": 585165,
        "settings_data": {
          "grouping": {
            "auto_upgrade": true,
            "recent_versions": [
              "21.0.0"
            ]
          }
        }
      }
    });

    await deployer.createProject();

    expect(stub.callCount).to.equal(1);

    stub.restore();
  });

  it('should throw an error if project name already exists', async function() {
    const options = {
      accessToken: 'xxxxxxxxxxxxxxxxxxxx',
      name: 'TestProject'
    };

    const deployer = new Deployer(options);
    const stub = sinon.stub(deployer.rollbarAPI.axios, 'post');
    stub.resolves({
      "err": 1,
      "message": "Project with this name already exists"
    });

    await deployer.createProject();

    expect(stub.callCount).to.equal(1);

    stub.restore();
  });
});
