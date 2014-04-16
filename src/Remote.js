'use strict';

var chalk = require('chalk');
/**
 * Run tests on selenium using webdriver protocol
 * 
 * @class Remote
 * @constructor
 * 
 * @param config {Object}
 * @param [config.webdriverURL='ondemand.saucelabs.com'] {String}
 * @param [config.webdriverPort=80] {String}
 * @param [config.user] {String} Selenium username
 * @param [config.key] {String} Selenium password
 * @param [config.url] {String} Url of the tests. Used by the default `onTest` method. The parameter `coverage=true`
 *                     will be automatically added when testing coverage.
 * @param [config.onTest] {Function} You can overide the default test method. It get the following parameters:
 * @param config.onTest.conf {Object}
 * @param config.onTest.conf.browser {wd} See [API here](https://github.com/admc/wd)
 * @param config.onTest.conf.url {String} 
 * @param config.onTest.conf.urlCoverage {String} 
 * @param config.onTest.cb {Function}
 * @param config.onTest.cb.status {Object} Status of the tests. API is the
 *                                 [advanced format here](https://saucelabs.com/docs/javascript-unit-tests-integration)
 * @param [config.onTest.cb.statusCoverage] {Object} If you ran in coverage mode. Same format as `status`
 * @param config.name {String} Name of the test on SauceLabs
 * @param config.browsers {Array.Object}
 * @param config.browsers.platform {String}
 * @param config.browsers.browserName {String}
 * @param config.browsers.version {String|Number}
 */
var Remote = function(config) {
	this.config = config;
	
	if (this.config.url) {
		if (typeof this.config.url === 'string') {
			this.config.url = [this.config.url];
		}
		for (var x = 0; x < this.config.url.length; x++) {
			if (typeof this.config.url[x] === 'string') {
				this.config.url[x] = {
					url: this.config.url[x]
				};
			}
		}
	}
	
	this.id = process.env.TRAVIS_BUILD_NUMBER;
	this.tags = [];
	if (this.id) {
		this.tags.push('travis');
	} else {
		this.tags.push('custom', '' + Math.floor(Math.random() * 100000000));
	}
	this.status = {};
	this.sessions = {};
};

/**
 * Run the tests
 * 
 * @method run
 * @param cb {Function} Callback when tests are finished running.
 * @param cb.failures {Number} Number of browsers that failed
 */
Remote.prototype.run = function(cb) {
	this.cb = cb;
	
	this.nbTests = this.config.browsers.length;
	this.startBrowser(0);
};

/**
 * Start the browser at `index`. When browser is ready, will call `startBrowser(index + 1)` if possible.
 * 
 * @method startBrowser
 * @private
 * 
 * @param index {Number} Index of the browser to start. `index` is a reference to `config.browsers` in
 *        {{#crossLink "Remote"}}{{/crossLink}}
 */
Remote.prototype.startBrowser = function(index) {
	var webdriver = require('wd');
	
	var b = this.config.browsers[index];
	var browser = webdriver.remote(
			this.config.webdriverURL || 'ondemand.saucelabs.com',
			this.config.webdriverPort || 80,
			this.config.user,
			this.config.key
	);
	var name = this.getBrowserName(b);
	var desired = {
		name: this.config.name + ' - ' + name,
		browserName: b.browserName,
		platform: b.platform,
		version: b.version,
		build: this.id,
		tags: this.tags
	};
	browser.on('status', function(info) {
		console.log('%s: ' + chalk.cyan('%s'), name, info.trim());
	});
	
	browser.on('command', function(meth, path, data) {
		if (path === '/session/:sessionID/url') path += ' ' + data.url;
		console.log('%s: > ' + chalk.yellow('%s') + ': %s', name, meth, path);
	});
	
	browser.init(desired, function(err) {
		var testDone = this.testDone.bind(this, browser, name);
		if (err) {
			console.log('%s: ' + chalk.red('%s') + ' (%s)', name, err.message);
			console.log(' > Requested browser:', desired);
			console.log(' > Error:', err);
			testDone(null);
		} else {
			var sessionData = {};
			this.sessions[browser.sessionID] = sessionData;
			sessionData.browser = browser;
			sessionData.browserName = name;
			sessionData.sessionId = browser.sessionID;
			sessionData.url = this.config.url;
			
			var onTest = this.config.onTest ? this.config.onTest.bind(sessionData) : this.onTest.bind(sessionData);
			onTest({
				browser: browser,
				url: this.config.url
			}, testDone);
		}
		
		if (this.config.browsers[index + 1]) {
			process.nextTick(function() {
				this.startBrowser(index + 1);
			}.bind(this));
		}
	}.bind(this));
};

/**
 * @method onTest
 * @private
 */
Remote.prototype.onTest = function(conf, cb) {
	var utils = require('./utils');
	
	var cover = function(url, cb) {
		this.onBrowserResult = function(data) {
			cb(null, JSON.parse(data.testResult));
		};
		conf.browser.get(utils.addUrlParam(url.url, 'sessionId', this.sessionId));
	}.bind(this);
	
	require('async').mapSeries(conf.url, cover, function(err, res) {
		cb.apply(null, res);
	});
};

/**
 * @method browserData
 * @private
 */
Remote.prototype.browserData = function(data) {
	var sessionId = JSON.parse(data.sessionId);
	var session = this.sessions[sessionId];
	
	if (session && session.onBrowserResult) {
		session.onBrowserResult(data);
	} else {
		console.error('Cannot find session <' + sessionId + '> while posting browser data.');
	}
};

/**
 * @method getBrowserName
 * @private
 */
Remote.prototype.getBrowserName = function(browser) {
	var name = browser.browserName;
	if (browser.version) name += ' ' + browser.version;
	if (browser.platform && browser.platform !== 'ANY') name += ' (' + browser.platform + ')';
	return name;
};

/**
 * @method testDone
 * @private
 */
Remote.prototype.testDone = function(browser, name /*, status...*/) {
	var sessionId = browser.sessionID;
	var sessionData = this.sessions[sessionId] || {};
	var report = Array.prototype.slice.call(arguments, 2);
	browser.quit(function() {
		this.status[name] = this.getReport(sessionData.url, report);
		this.report(sessionId, this.status[name], name, this.finish.bind(this));
	}.bind(this));
};

/**
 * @method finish
 * @private
 */
Remote.prototype.finish = function() {
	if (0 === --this.nbTests) {
		this.displayResults();
	}
};

/**
 * @method report
 * @private
 */
Remote.prototype.report = function(sessionId, status, name, done) {
	var success = !!(status.full && status.full.passed);
	
	if (!this.config.webdriverURL) {
		var Sauce = require('saucelabs');
		
		var myAccount = new Sauce({
			username: this.config.user,
			password: this.config.key
		});
		
		myAccount.updateJob(sessionId, {
			passed: success,
			'custom-data': {
				mocha: status.simple // Cannot send full report: http://support.saucelabs.com/entries/23287242
			}
		}, function(err) {
			if (err) {
				console.log('%s: > job %s: ' + chalk.red('unable to set status:'), name, sessionId, err);
			} else {
				console.log('%s: > job %s marked as %s', name, sessionId,
						success ? chalk.green('passed') : chalk.red('failed'));
			}
			done();
		});
	} else {
		console.log('%s: > job %s: %s', name, sessionId,
				success ? chalk.green('passed') : chalk.red('failed'));
		done();
	}
};

Remote.prototype.getReport = function(urls, reports) {
	if (!reports || !reports[0] || urls.length !== reports.length) return {};
	var prefix = '';
	
	var simple = {
		failed: 0,
		passed: 0,
		total: 0
	};
	var errors = [];
	
	var test = function(t) {
		simple.total++;
		if (t.passed) {
			simple.passed++;
		} else {
			errors.push(t.mochaTest);
			t.mochaTest.fullTitle = prefix + t.mochaTest.fullTitle;
			delete t.mochaTest;
			simple.failed++;
		}
	};
	var suite = function(s) {
		if (s.specs) s.specs.forEach(test);
		if (s.suites) s.suites.forEach(suite);
	};
	
	var durationSec = 0;
	var passed = true;
	
	for (var i = 0; i < urls.length; i++) {
		prefix = urls[i].prefix || '';
		var description = prefix;
		if (prefix) prefix += ': ';
		
		suite(reports[i]);
		
		durationSec += reports[i].durationSec;
		if (urls.length >= 2) {
			passed = passed && reports[i].passed;
			reports[i].description = description || 'standard';
		}
	}
	
	var report = reports[0];
	if (urls.length >= 2) {
		report = {
			suites: reports,
			durationSec: durationSec,
			passed: passed
		};
	}
	simple.runtime = durationSec * 1000;
	
	return {
		simple: simple,
		full: report,
		errors: errors
	};
};

/**
 * @method displayResults
 * @private
 */
Remote.prototype.displayResults = function() {
	var failures = 0;
	var report = {};
	
	console.log();
	console.log();
	console.log('**********************************');
	console.log('*             Status             *');
	console.log('**********************************');
	console.log();
	console.log();
	this.config.browsers.forEach(function(browser) {
		var name = this.getBrowserName(browser);
		var status = this.status[name];
		
		report[name] = status.full;
		
		var ok = status.simple && status.simple.passed;
		var failed = status.simple && status.simple.failed;
		
		if (!ok && !failed) {
			console.log('    %s: ' +  chalk.red('no results'), name);
			failures++;
		} else if (failed) {
			console.log('    %s: ' + chalk.red('%d/%d failed'), name, failed, ok + failed);
			failures++;
		} else {
			console.log('    %s: ' + chalk.green('%d passed'), name, ok);
		}
		
		if (failed) {
			var n = 0;
			status.errors.forEach(function(test) {
				var stack = test.err.stack || test.err.message || '';
				console.log();
				console.log('      %d) %s', ++n, test.fullTitle);
				if (stack) {
					console.log(chalk.red('%s'), stack.replace(/^/gm, '        '));
					console.log();
					console.log();
				}
			}, this);
		}
	}, this);
	console.log();
	console.log();
	if (this.cb) this.cb(failures, this.finalizeReport(report));
};

Remote.prototype.finalizeReport = function(report) {
	var newReport = {
		passed: true,
		durationSec: 0,
		suites: []
	};
	for (var key in report) {
		if (report[key]) {
			var suite = report[key];
			suite.description = key;
			newReport.suites.push(suite);
			newReport.durationSec += suite.durationSec;
			if (!suite.passed) newReport.passed = false;
		}
	}
	
	return newReport;
};

exports = module.exports = Remote;
