/* jshint lastsemic: true */
/* globals define:true */
if (typeof define !== 'function') {var define = require('amdefine')(module)}

define(['./browserUtils'], function(browserUtils) {
	/* jshint evil: true */
	var global = new Function('return this')();
	var Date = global.Date; // Save Date reference to avoid Sinon interfering
	
	// Result format is the advanced format described here:
	// https://saucelabs.com/docs/javascript-unit-tests-integration
	return function(runner) {
		var result = {};
		var stack = [];
		var currentSuite = result;
		var testStart;
		
		var failTest = function(result, mochaTest) {
			result.failedCount = 1;
			result.passedCount = 0;
			// Format addition. Used for error reporting in the console.
			result.mochaTest = {
				fullTitle: mochaTest.fullTitle(),
				err: {
					message: mochaTest.err.message,
					stack: mochaTest.err.stack
				}
			};
		};
		
		runner.on('suite', function(suite) {
			var newSuite = {
				description: suite.title,
				start: new Date(),
				passed: true
			};
			stack.push(newSuite);
			if (!currentSuite.suites) currentSuite.suites = [];
			currentSuite.suites.push(newSuite);
			currentSuite = newSuite;
		});
		
		runner.on('suite end', function() {
			currentSuite.durationSec = (new Date() - currentSuite.start) / 1000;
			delete currentSuite.start;
			stack.pop();
			var parentSuite = stack[stack.length - 1];
			if (!currentSuite.passed && parentSuite) parentSuite.passed = false;
			currentSuite = parentSuite;
		});
		
		runner.on('test', function() {
			testStart = new Date();
		});
		
		runner.on('test end', function(test) {
			if (!currentSuite.specs) currentSuite.specs = [];
			var t = {
				description: test.title,
				durationSec: (new Date() - testStart) / 1000,
				passed: test.state === 'passed',
				totalCount: 1,
				passedCount: 1,
				failedCount: 0
			};
			if (!t.passed) {
				currentSuite.passed = false;
				failTest(t, test);
			}
			currentSuite.specs.push(t);
		});
		
		runner.on('fail', function(test) {
			var stack = [];
			while (test.parent) {
				stack.push(test);
				test = test.parent;
			}
			
			var res = result.suites[0];
			for (var i = stack.length - 1; i >= 0; i--) {
				test = stack[i];
				var childs = (i === 0) ? res.specs : res.suites;
				for (var j = 0; j < childs.length; j++) {
					if (childs[j].description === test.title) {
						res = childs[j];
						res.passed = false;
						if (i === 0) {
							failTest(res, test);
						}
						break;
					}
				}
			}
		});
		
		runner.on('end', function() {
			global.mochaResults = result.suites[0];
			delete global.mochaResults.description;
			
			var sessionId = browserUtils.getQueryParam('sessionId');
			if (sessionId) {
				// Ugly hack. Wait for coverage data to be posted first.
				// Otherwise, the browser might be closed too fast 
				setTimeout(function() {
					browserUtils.postData('/browserData', {sessionId: sessionId, testResult: result.suites[0]});
				}, 1000);
			}
		});
	};
});
