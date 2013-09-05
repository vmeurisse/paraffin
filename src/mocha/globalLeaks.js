/* jshint lastsemic: true */
/* globals define:true, mocha: true */
if (typeof define !== 'function') {var define = require('amdefine')(module)}

define(function() {
	
	var filter = function(arr, fn) {
		if (arr.filter) return arr.filter(fn);
		var res = [];
		for (var i = 0; i < arr.length; i++) {
			if (fn(arr[i], i, arr)) {
				res.push(arr[i]);
			}
		}
		return res;
	};
	
	var indexOf = function(arr, val) {
		if (arr.indexOf) return arr.indexOf(val);
		for (var i = 0; i < arr.length; i++) {
			if (arr[i] === val) return i;
		}
		return -1;
	};
	
	/*
	 * Non-enumerable globals.
	 */
	var globals = [
		'setTimeout',
		'clearTimeout',
		'setInterval',
		'clearInterval',
		'XMLHttpRequest',
		'Date'
	];
	
	var GlobalChecker = function(runner) {
		this.runner = runner;
		
		runner.on('test', this.beforeTest.bind(this));
		runner.on('hook', this.beforeTest.bind(this));
		
		runner.on('test end', this.checkGlobals.bind(this));
		runner.on('hook end', this.checkGlobals.bind(this));
		
		this._globals = [];
		this.testSkiped = true;
		
		this.ignoreLeaks = !!mocha.options.ignoreLeaks;
		mocha.options.ignoreLeaks = true;
	};
	
	GlobalChecker.prototype.getGlobals = function() {
		var props = Object.keys(global);
		
		// non-enumerables
		for (var i = 0; i < globals.length; ++i) {
			if (indexOf(props, globals[i]) !== -1) continue;
			props.push(globals[i]);
		}
		
		return props;
	};
	
	GlobalChecker.prototype.beforeTest = function(test) {
		if (this.testSkiped && this.shouldCheckGlobals(test)) {
			this.testSkiped = false;
			this.checkNewGlobals();
		}
	};
	
	GlobalChecker.prototype.checkNewGlobals = function() {
		var ok = this._globals;
		var globals = this.getGlobals();
		var isNode = global.process && global.process.kill;
		var leaks;
		
		// check length - 2 ('errno' and 'location' globals)
		if (isNode && 1 === ok.length - globals.length) return;
		else if (2 === ok.length - globals.length) return;

		leaks = this.filterLeaks(ok, globals);
		this._globals = this._globals.concat(leaks);
		return leaks;
	};
	
	GlobalChecker.prototype.checkGlobals = function(test) {
		if (!this.shouldCheckGlobals(test)) {
			this.testSkiped = true;
			return;
		}
		
		var leaks = this.checkNewGlobals();
		
		if (leaks.length > 1) {
			this.runner.fail(test, new Error(leaks.length + ' global leaks detected: ' + leaks.join(', ') + ''));
		} else if (leaks.length) {
			this.runner.fail(test, new Error('global leak detected: ' + leaks[0]));
		}
	};
	
	GlobalChecker.prototype.shouldCheckGlobals = function(test) {
		test = {parent: test};
		while (test.parent) {
			test = test.parent;
			if (test.ignoreLeaks !== undefined) return !test.ignoreLeaks;
		}
		return !this.ignoreLeaks;
	};
	
	GlobalChecker.prototype.filterLeaks = function (ok, globals) {
		return filter(globals, function(key) {
			// Firefox and Chrome exposes iframes as index inside the window object
			if (/^d+/.test(key)) return false;
			var matched = filter(ok, function(ok) {
				if (ok.indexOf('*') !== -1) return 0 === key.indexOf(ok.split('*')[0]);
				// Opera and IE expose global variables for HTML element IDs (issue #243)
				if (/^mocha-/.test(key)) return true;
				return key === ok;
			});
			return matched.length === 0 && (!global.navigator || 'onerror' !== key);
		});
	};
	
	return GlobalChecker;
});
