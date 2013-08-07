/* jshint browser: true */
/* globals Mocha, mocha, define */

if (window.ActiveXObject || !window.postMessage) {
	// fix for https://github.com/visionmedia/mocha/issues/502
	window.setImmediate = function(fn) {
		var scriptEl = global.document.createElement('script');
		scriptEl.onreadystatechange = function () {
			scriptEl.onreadystatechange = null;
			scriptEl.parentNode.removeChild(scriptEl);
			scriptEl = null;
			fn();
		};
		global.document.documentElement.appendChild(scriptEl);
	};
}

define(['module', './browserUtils', './multiReporter', './testStatusReporter', './coveragePosterReporter',
		'../../node_modules/mocha/mocha'],
		function(module, browserUtils, multiReporter, TestStatusReporter, CoveragePosterReporter) {
	
	mocha.setup('tdd');
	mocha.reporter(multiReporter.get(Mocha.reporters.HTML, CoveragePosterReporter, TestStatusReporter));
	
	// Load the CSS
	var link = document.createElement('link');
	link.type = 'text/css';
	link.rel = 'stylesheet';
	link.href = module.uri.split('/').slice(0, -1).join('/') + '/../../node_modules/mocha/mocha.css';
	document.getElementsByTagName('head')[0].appendChild(link);
	
	if (browserUtils.getQueryParam('coverage') === 'true') {
		window.process.env = {
			SMPL_COVERAGE: '1'
		};
	}
	
	return mocha;
});
