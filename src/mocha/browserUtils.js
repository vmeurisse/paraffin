/* jshint browser: true */
/* globals define, ActiveXObject*/
define(function() {
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
	
	var XMLHttpRequest = window.XMLHttpRequest || function() {
		try {
			return new ActiveXObject('MSXML2.XMLHTTP.6.0');
		} catch (e) {
		}
		try {
			return new ActiveXObject('MSXML2.XMLHTTP.3.0');
		} catch (e) {
		}
		return null;
	};
	
	var ajaxQueue = [];
	var ajaxRunning = false;
	browserUtils.postData = function(url, data) {
		if (ajaxRunning) return ajaxQueue.push(arguments);
		ajaxRunning = true;
		var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
		xhr.onreadystatechange = function() {
			if (xhr.readyState === 4) {
				ajaxRunning = false;
				if (ajaxQueue.length) browserUtils.postData.apply(browserUtils, ajaxQueue.shift());
			}
		};
		var query = [];
		for (var key in data) {
			query.push(encodeURIComponent(key) + '=' + encodeURIComponent(browserUtils.stringify(data[key])));
		}
		xhr.send(query.join('&'));
	};
	
	browserUtils.getQueryParam = function(key) {
		var match = location.search.match('[?&]' + key + '=([^#$&]*)');
		return match && match[1];
	};
	
	return browserUtils;
});

