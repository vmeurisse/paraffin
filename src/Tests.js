
/**
 * Server used to run unit tests
 * 
 * @class Tests
 * @constructor
 * 
 * @param config {Object}
 * @param [config.server] {Object} config for {{#crossLink "Server"}}{{/crossLink}}
 * @param [config.remote] {Object} config for {{#crossLink "Remote"}}{{/crossLink}}
 * @param [config.node] {Object} config for {{#crossLink "NodeTests"}}{{/crossLink}}
 * @param [config.coverage] {Object} config for {{#crossLink "Coverage"}}{{/crossLink}}
 * @param [config.manualStop] {Boolean} If true, server is not stopped automatically and coverage report is delayed.
 *                            You need to manually call the stop method to end the tests.
 * @param [config.reporter] {Array} First element is a reporter.
 * @param config.reporter.0 {String|Function} If it's a string it should be one of the know reporters (only 'Xunit' for
 *                          now.
 *                          The repporter is called as a constructor with two parameters: Report and Options.
 * @param config.reporter.1 {Object} Options for the reporter
 */
var Tests = function(config) {
	this.config = config;
	
	var actions = this.actions = {};
	actions.runServer = !!this.config.server;
	actions.runNodeTests = !!(this.config.node && (!this.config.coverage || !this.config.coverage.coverageOnly));
	actions.runNodeCoverage = !!(this.config.coverage && this.config.node);
	actions.prepareCoverage = !!this.config.coverage;
	actions.runRemote = !!this.config.remote;
	actions.coverageReport = !!(this.config.coverage && this.config.server);
	
	var needStop = !!this.config.server;
	actions.autoStop = needStop && !this.config.manualStop;
	actions.manualStop = needStop && !!this.config.manualStop;
};


Tests.prototype.run = function(cb) {
	this.testStatus = {};
	
	var actions = [];
	
	if (this.actions.runServer) actions.push(this.startServer.bind(this));
	if (this.actions.runNodeTests) actions.push(this.runTests.bind(this, 'standard'));
	if (this.actions.prepareCoverage) actions.push(this.prepareCoverage.bind(this));
	if (this.actions.runNodeCoverage) actions.push(this.runTests.bind(this, 'coverage'));
	if (this.actions.runRemote) actions.push(this.runRemote.bind(this));
	
	require('async').series(actions, function(err) {
		if (this.actions.autoStop) {
			this.stop(function() {
				if (cb) {
					// Small delay so that all messages get time to be written to console before returning to caller 
					setTimeout(function() {
						cb(err);
					}, 100);
				}
			}.bind(this));
		}
	}.bind(this));
	
	
	if (this.actions.manualStop) {
		return {
			stop: this.stop.bind(this)
		};
	}
};

Tests.prototype.stop = function(cb) {
	if (this.actions.coverageReport) {
		this.coverage.report();
	}
	if (this.server) {
		this.stopServer(cb);
	}
	
	if (this.config.reporter) {
		var Reporter = this.config.reporter[0];
		if (Reporter === 'Xunit') Reporter = require('./Xunit');
		new Reporter(this.config.reporter[1], this.testStatus);
	}
};

/**
 * Start the webserver
 * 
 * @method startServer
 * @private
 */
Tests.prototype.startServer = function(cb) {
	if (!this.server) {
		var Server = require('./Server');
		
		this.server = new Server(this.config.server);
		this.server.start(function(err, address) {
			if (this.config.remote && this.config.remote.url) {
				var url = require('url');
				var u = url.parse(this.config.remote.url);
				if (u.port === '0') {
					delete u.host;
					u.port = address.port;
					this.config.remote.url = url.format(u);
				}
			}
			cb();
		}.bind(this));
	}
};

/**
 * Stop the webserver
 * 
 * @method stopServer
 * @private
 */
Tests.prototype.stopServer = function(cb) {
	this.server.stop(function() {
		delete this.server;
		console.log('server stoped');
		if (cb) cb();
	}.bind(this));
};

Tests.prototype.runTests = function(type, cb) {
	var NodeTests = require('./NodeTests');
	var coverage = (type === 'coverage') ? this.coverage : null;
	new NodeTests(this.config.node).run(coverage, cb);
};

Tests.prototype.prepareCoverage = function(cb) {
	var Coverage = require('./Coverage');
	this.coverage = new Coverage(this.config.coverage);
	this.coverage.prepare();
	if (this.server) this.server.setCoverage(this.coverage);
	cb();
};

Tests.prototype.runRemote = function(cb) {
	var Remote = require('./Remote');
	new Remote(this.config.remote).run(!!this.coverage, function(err, status) {
		for (var key in status) {
			this.testStatus[key] = status[key];
		}
		cb.apply(null, arguments);
	}.bind(this));
};

module.exports = Tests;
