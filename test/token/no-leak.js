'use strict';

const expect = require('chai').expect;

// Fails if `text` contains any 8-character run of `secret`.
function expectNoPartOf(text, secret) {
  for (let i = 0; i + 8 <= secret.length; i++) {
    expect(text).not.to.include(secret.slice(i, i + 8));
  }
}

module.exports = { expectNoPartOf };
