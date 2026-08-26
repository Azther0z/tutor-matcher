import assert from 'node:assert/strict';
import { Then, When } from '@cucumber/cucumber';
import request from 'supertest';
import app from '../../src/app';
import type { TutorMatcherWorld } from '../support/world';

When('I request the health endpoint', async function (this: TutorMatcherWorld) {
  this.response = await request(app).get('/health');
});

Then('the response status is {int}', function (this: TutorMatcherWorld, status: number) {
  assert.ok(this.response, 'Expected a response from the backend');
  assert.equal(this.response.status, status);
});

Then('the response body reports an ok status', function (this: TutorMatcherWorld) {
  assert.ok(this.response, 'Expected a response from the backend');
  assert.deepEqual(this.response.body, { status: 'ok' });
});
