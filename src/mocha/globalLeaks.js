/* jshint lastsemic: true */
/* globals define:true, mocha: true */
if (typeof define !== 'function') {var define = require('amdefine')(module)}

define(function() {
	
	var filter = function(arr, fn, scope) {
		if (arr.filter) return arr.filter(fn, scope);
		var res = [];
		for (var i = 0; i < arr.length; i++) {
			if (fn.call(scope, arr[i], i, arr)) {
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
		this._ignoredGlobals = [];
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
		var ignored = this._ignoredGlobals;
		
		var globals = this.getGlobals();
		var leaks;
		
		if (ok.length + ignored.length === globals.length) return [];

		leaks = this.filterLeaks(globals);
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
	
	GlobalChecker.prototype.filterLeaks = function (globals) {
		var ignored = [];
		globals = filter(globals, function(key) {
			var isIgnored = /^d+/.test(key) || // Firefox and Chrome exposes iframes as index inside the window object
			                /^mocha-/.test(key); // Opera and IE expose global variables for HTML IDs (issue mocha#243)
			if (isIgnored) {
				ignored.push(key);
				return false;
			}
			return indexOf(this._globals, key) === -1;
		}, this);
		this._ignoredGlobals = ignored;
		return globals;
	};
	
	return GlobalChecker;
});
