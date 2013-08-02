
var fs = require('fs');
var path = require('path');
var shjs = require('shelljs');
shjs.config.fatal = true; //tell shelljs to fail on errors

/**
 * Test status reporter that write a file in the [xUnit format](https://gist.github.com/jzelenkov/959290)
 * 
 * @class Xunit
 * @constructor
 * 
 * @param options {Object}
 * @param options.filename {string} Path of the file to write the report
 * @param testStatus {Object}
 */
var Xunit = function(options, testStatus) {
	var tests = this.getTests(testStatus);
	
	this.report = '<?xml version="1.0" encoding="UTF-8"?>\n';
	this.report += this.tag('testsuite', {
		name: 'Mocha Tests',
		tests: tests.total,
		failures: tests.failed,
		errors: tests.failed,
		skip: tests.total - tests.failed - tests.passed,
		timestamp: (new Date()).toUTCString(),
		time: tests.durationSec
	}) + '\n';

	tests.tests.forEach(this.test, this);
	
	this.report += '</testsuite>\n';
	
	shjs.mkdir('-p', path.dirname(options.filename));
	fs.writeFileSync(options.filename, this.report);
};

Xunit.prototype.getTests = function(testStatus) {
	var tests = [];
	var status = {
		tests: tests,
		total: 0,
		failed: 0,
		passed: 0,
		durationSec: testStatus.durationSec
	};
	
	var currentClasspath = '';
	
	var test = function(t) {
		tests.push({
			test: t,
			classpath: currentClasspath
		});
		
		status.total++;
		if (t.passed) {
			status.passed++;
		} else {
			status.failed++;
		}
	};
	var suite = function(parentClass, s) {
		var classPath = (parentClass ? parentClass + '.' : parentClass) + this.nameToJavaLike(s.description);
		currentClasspath = classPath;
		if (s.specs) s.specs.forEach(test);
		if (s.suites) s.suites.forEach(suite.bind(this, classPath));
	};
	suite.call(this, '', testStatus);
	
	return status;
};



Xunit.prototype.nameToJavaLike = function(desc) {
	return (desc || '').replace(/ /g, '_')
	                   .replace(/\./g, '\u2024');
};

Xunit.prototype.test = function(t) {
	var test = t.test;
	var attrs = {
		classname: t.classpath,
		name: this.nameToJavaLike(test.description),
		time: test.durationSec
	};

	if (!test.passed) {
		//var err = test.err;
		//attrs.message = escape(err.message);
		//this.report += this.tag('testcase', attrs, false, this.tag('failure', attrs, false, this.cdata(err.stack)));
		this.report += '\t' + this.tag('testcase', attrs) + '\n';
		this.report += '\t\t' + this.tag('failure', attrs, true) + '\n';
		this.report += '\t</testcase>\n';
	} else {
		this.report += '\t' + this.tag('testcase', attrs, true) + '\n';
	}
};

Xunit.prototype.escapeXMLAttr = function(str) {
	return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
};

Xunit.prototype.tag = function(name, attrs, close) {
	var pairs = [];
	
	for (var key in attrs) {
		pairs.push(key + '="' + this.escapeXMLAttr(attrs[key]) + '"');
	}
	
	return '<' + name + (pairs.length ? ' ' + pairs.join(' ') : '') + (close ? '/' : '') + '>';
};

module.exports = Xunit;
