/* jshint browser: true */
/* globals define */
define(['./browserUtils'], function(browserUtils) {
	return function(runner) {
		runner.on('end', function() {
			var COVERAGE_KEY = '__coverage__'; //Coverage published by istanbul
			if (window[COVERAGE_KEY]) {
				browserUtils.postData('/postCoverage', {coverage: window[COVERAGE_KEY]});
			}
		});
	};
});
