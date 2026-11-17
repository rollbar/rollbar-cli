'use strict';

// An error whose message is safe to show: it doesn't repeat any of the input,
// which may be a secret. The command shows only these messages; any other
// error is reduced to its code.
class SafeMessageError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
  }
}

module.exports = {
  SafeMessageError,
};
