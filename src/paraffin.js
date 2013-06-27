/**
 * Set of utilities to build javascript projects
 *
 * @module paraffin
 * @class paraffin
 * @static
 */
'use strict';

/**
 * Run unit tests
 * 
 * @method tests
 * @param config {Object} config. See {{#crossLink "Tests"}}{{/crossLink}}
 * @param cb {Function} Callback when tests are finished running.
 * @param cb.err {*} Errors, if any.
 * @return {Object} If `config.manualStop` is `true`, return an object with a `stop` method.
 */
exports.tests = function(config, cb) {
	var Tests = require('./Tests');
	return new Tests(config).run(cb);
};
