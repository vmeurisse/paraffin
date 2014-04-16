var chalk = require('chalk');

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
 * @param [config.sauceConnect] {Object} config for {{#crossLink "SauceConnect"}}{{/crossLink}}
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
	actions.runNodeTests = !!(this.config.node && (!this.config.coverage || !this.config.coverage.coverageOnly));
	actions.prepareCoverage = !!this.config.coverage;
	actions.runNodeCoverage = !!(this.config.coverage && this.config.node);
	actions.runServer = !!this.config.server;
	actions.sauceConnect = !!this.config.sauceConnect;
	actions.runRemote = !!this.config.remote;
	actions.coverageReport = !!(this.config.coverage && this.config.server);
	
	var needStop = actions.runServer || actions.sauceConnect;
	actions.autoStop = needStop && !this.config.manualStop;
	actions.manualStop = needStop && !!this.config.manualStop;
};


Tests.prototype.run = function(cb) {
	var runner = {};
	this.testStatus = {};
	
	var actions = [];
	
	if (this.actions.runNodeTests) actions.push(this.runTests.bind(this, 'standard'));
	if (this.actions.prepareCoverage) actions.push(this.prepareCoverage.bind(this));
	if (this.actions.runNodeCoverage) actions.push(this.runTests.bind(this, 'coverage'));
	if (this.actions.runServer) actions.push(this.startServer.bind(this));
	if (this.actions.sauceConnect) actions.push(this.startSauceConnect.bind(this));
	if (this.actions.runRemote) actions.push(this.runRemote.bind(this));
	
	if (this.actions.manualStop) {
		runner.stop = this.stop.bind(this);
	}
	require('async').series(actions, function(err) {
		if (this.actions.manualStop) {
			if (cb) {
				process.stdout.write('', function() {
					cb(err, runner);
				});
			}
		}
		if (this.actions.autoStop) {
			this.stop(function(stopErr) {
				if (cb) {
					process.stdout.write('', function() {
						cb(err || stopErr);
					});
				}
			}.bind(this));
		}
	}.bind(this));
	
	
	if (this.actions.manualStop) {
		return runner;
	}
};

Tests.prototype.stop = function(cb) {
	var actions = [];
	if (this.sauceConnect) actions.push(this.stopSauceConnect.bind(this));
	if (this.server) actions.push(this.stopServer.bind(this));
	if (this.actions.coverageReport && this.coverage) actions.push(this.coverage.report.bind(this.coverage));
	
	require('async').series(actions, function(err) {
		if (this.config.reporter) {
			var Reporter = this.config.reporter[0];
			if (Reporter === 'Xunit') Reporter = require('./Xunit');
			new Reporter(this.config.reporter[1], this.testStatus);
		}
		cb(err);
	}.bind(this));
};

/**
 * Start the webserver
 * 
 * @method startServer
 * @private
 */
Tests.prototype.startServer = function(cb) {
	if (!this.server) {
		this.displayAction('Starting server...');
		var Server = require('./Server');
		
		this.server = new Server(this.config.server);
		if (this.coverage) this.server.setCoverage(this.coverage);
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
			this.displayStatus(err);
			cb(err);
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
	this.displayAction('Stopping server...');
	this.server.stop(function() {
		delete this.server;
		this.displayStatus();
		if (cb) cb();
	}.bind(this));
};


/**
 * Start Sauce Connect
 * 
 * @method startSauceConnect
 * @private
 */
Tests.prototype.startSauceConnect = function(cb) {
	this.displayAction('Starting Sauce Connect...', true);
	var SauceConnect = require('./SauceConnect');
	this.sauceConnect = new SauceConnect(this.config.sauceConnect).start(function(err) {
		this.displayStatus(err);
		if (cb) cb(err);
	}.bind(this));
};

/**
 * Stop Sauce Connect
 * 
 * @method stopSauceConnect
 * @private
 */
Tests.prototype.stopSauceConnect = function(cb) {
	this.displayAction('Stopping Sauce Connect...');
	this.sauceConnect.stop(function(err) {
		delete this.sauceConnect;
		this.displayStatus(err);
		if (cb) cb(err);
	}.bind(this));
};

Tests.prototype.runTests = function(type, cb) {
	this.displayAction('Running tests...');
	var NodeTests = require('./NodeTests');
	var coverage = (type === 'coverage') ? this.coverage : null;
	new NodeTests(this.config.node).run(coverage, function(err) {
		this.displayStatus(err);
		cb.apply(null, arguments);
	}.bind(this));
};

Tests.prototype.prepareCoverage = function(cb) {
	this.displayAction('Preparing coverage...', true);
	var Coverage = require('./Coverage');
	this.coverage = new Coverage(this.config.coverage);
	this.coverage.prepare();
	process.stdout.write('\n');
	this.displayStatus();
	cb();
};

Tests.prototype.runRemote = function(cb) {
	this.displayAction('Running remote tests...', true);
	var Remote = require('./Remote');
	var config = Object.create(this.config.remote);
	if (this.config.coverage && config.url) {
		config.url = this.processRemoteURL(this.config.coverage.coverageOnly, config.url);
	}
	var remote = new Remote(config);
	if (this.server) {
		this.server.addPostHandler('/browserData', remote.browserData.bind(remote));
	}
	remote.run(function(err, status) {
		for (var key in status) {
			this.testStatus[key] = status[key];
		}
		cb.apply(null, arguments);
	}.bind(this));
};

Tests.prototype.processRemoteURL = function(coverageOnly, url) {
	if (Array.isArray(url)) return url;
	var utils = require('./utils');
	if (coverageOnly) {
		url = [utils.addUrlParam(url, 'coverage', 'true')];
	} else {
		url = [{
			url: url
		}, {
			url: utils.addUrlParam(url, 'coverage', 'true'),
			prefix: 'coverage'
		}];
	}
	return url;
};

Tests.prototype.displayAction = function(status, newLine) {
	while (status.length < 50) status += ' ';
	process.stdout.write('* ' + status + (newLine ? '\n' : ''));
};

Tests.prototype.displayStatus = function(err) {
	if (err) {
		process.stdout.write('[ ' + chalk.red('fail') + ' ]\n');
	} else {
		process.stdout.write('[   ' + chalk.green('ok') + ' ]\n');
	}
};

module.exports = Tests;
