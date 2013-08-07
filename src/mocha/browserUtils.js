/* jshint browser: true */
/* globals define */
define(function() {
	var i = 10;
	while (i--) {
		window['paraffinPost' + i] = ''; //Prevent mocha to detect the iframes as new globals
	}

	var escapeHTML = function(string) {
		return String(string).replace(/&/g, '&amp;')
		                     .replace(/"/g, '&quot;')
		                     .replace(/'/g, '&#39;')
		                     .replace(/</g, '&lt;')
		                     .replace(/>/g, '&gt;');
	};
	
	//Browser utils for crappy browsers
	var browserUtils = {};
	
	browserUtils.stringify = window.JSON && JSON.stringify || function (obj) {
		var t = typeof obj;
		if (t !== 'object' || obj === null) {
			if (t === 'string') obj = '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
			return '' + obj;
		} else {
			var json = [], arr = (obj.constructor === Array);
			for (var k in obj) {
				json.push((arr ? '' : browserUtils.stringify(k) + ':') + browserUtils.stringify(obj[k]));
			}
			return (arr ? '[' : '{') + json + (arr ? ']' : '}');
		}
	};
	
	var iframeIndex = 0;
	browserUtils.postData = function(url, data) {
		var div = document.createElement('div');
		var iframeName = 'paraffinPost' + (iframeIndex++);
		var innerHTML = '<iframe name="' + iframeName + '" style="display:none"></iframe>' +
		                '<form method="post" target="' + iframeName + '" action="' + escapeHTML(url) + '">';
		
		for (var key in data) {
			innerHTML += '<textarea style="display:none" name="' + escapeHTML(key) + '">' +
			                  escapeHTML(browserUtils.stringify(data[key])) +
			             '</textarea>';
		}
		innerHTML += '</form>';
		
		div.innerHTML = innerHTML;
		document.body.appendChild(div);
		div.getElementsByTagName('form')[0].submit();
	};
	
	return browserUtils;
});
