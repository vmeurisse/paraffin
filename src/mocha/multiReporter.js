/* jshint lastsemic: true */
/* globals define:true */
if (typeof define !== 'function') {var define = require('amdefine')(module)}

define(function() {
	return {
		get: function() {
			var reporters = arguments;
			return function(runner) {
				for (var i = 0; i < reporters.length; i++) {
					new reporters[i](runner);
				}
			};
		}
	};
});
