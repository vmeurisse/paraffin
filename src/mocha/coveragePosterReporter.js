/* jshint browser: true */
/* globals define */
define(function() {
	window.paraffinCoverageResults = ''; //Prevent mocha to detect the iframe as new global
	
	var stringify = window.JSON && JSON.stringify || function (obj) {
		var t = typeof obj;
		if (t !== 'object' || obj === null) {
			if (t === 'string') obj = '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
			return '' + obj;
		} else {
			var json = [], arr = (obj.constructor === Array);
			for (var k in obj) {
				json.push((arr ? '' : stringify(k) + ':') + stringify(obj[k]));
			}
			return (arr ? '[' : '{') + json + (arr ? ']' : '}');
		}
	};
	
	return function(runner) {
		runner.on('end', function() {
			var COVERAGE_KEY = '__coverage__'; //Coverage published by istanbul
			if (window[COVERAGE_KEY]) {
				// Poor man AJAX
				var iframe = document.createElement('iframe');
				iframe.style.display = 'none';
				iframe.name = 'paraffinCoverageResults';
				document.body.appendChild(iframe);
				var ta = document.createElement('textarea');
				ta.name = 'coverage';
				ta.value = stringify(window[COVERAGE_KEY]);
				var form = document.createElement('form');
				form.method = 'post';
				form.target = 'paraffinCoverageResults';
				form.action = location.protocol + '//' + location.host + '/postResults';
				form.appendChild(ta);
				form.style.display = 'none';
				document.body.appendChild(form);
				form.submit();
			}
		});
	};
});
