/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as popularLabs from '../../../src/helpers/popularLabs';
import * as cloneRepo from '../../../src/commands/cloneRepo';
import { clonePopularRepo } from '../../../src/commands/clonePopularRepo';

describe('clonePopularRepo', () => {
  let pickPopularRepoStub: sinon.SinonStub;
  let cloneRepoFromUrlStub: sinon.SinonStub;

  beforeEach(() => {
    pickPopularRepoStub = sinon.stub(popularLabs, 'pickPopularRepo');
    cloneRepoFromUrlStub = sinon.stub(cloneRepo, 'cloneRepoFromUrl');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should clone selected repo', async () => {
    const mockPick = {
      label: 'test-repo',
      repo: 'https://github.com/test/test-repo'
    };
    pickPopularRepoStub.resolves(mockPick);
    cloneRepoFromUrlStub.resolves();

    await clonePopularRepo();

    expect(pickPopularRepoStub.calledOnce).to.be.true;
    expect(pickPopularRepoStub.calledWith('Clone popular lab', 'Select a repository to clone')).to.be.true;
    expect(cloneRepoFromUrlStub.calledOnce).to.be.true;
    expect(cloneRepoFromUrlStub.calledWith('https://github.com/test/test-repo')).to.be.true;
  });

  it('should exit early when picker cancelled', async () => {
    pickPopularRepoStub.resolves(undefined);

    await clonePopularRepo();

    expect(pickPopularRepoStub.calledOnce).to.be.true;
    expect(cloneRepoFromUrlStub.called).to.be.false;
  });

  it('should handle null picker result', async () => {
    pickPopularRepoStub.resolves(null);

    await clonePopularRepo();

    expect(cloneRepoFromUrlStub.called).to.be.false;
  });

  it('should pass correct arguments to pickPopularRepo', async () => {
    pickPopularRepoStub.resolves(undefined);

    await clonePopularRepo();

    expect(pickPopularRepoStub.firstCall.args[0]).to.equal('Clone popular lab');
    expect(pickPopularRepoStub.firstCall.args[1]).to.equal('Select a repository to clone');
  });
});
