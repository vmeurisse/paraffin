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
				var actionUrl = location.protocol + '//' + location.host + '/postResults';
				var div = document.createElement('div');
				div.innerHTML = '<iframe name="paraffinCoverageResults" style="display:none"></iframe>' +
				                '<form method="post" target="paraffinCoverageResults" action="' + actionUrl + '">' +
				                    '<textarea style="display:none" name="coverage" />' +
				                '</form>';
				document.body.appendChild(div);
				div.getElementsByTagName('textarea')[0].value = stringify(window[COVERAGE_KEY]);
				div.getElementsByTagName('form')[0].submit();
			}
		});
	};
});
