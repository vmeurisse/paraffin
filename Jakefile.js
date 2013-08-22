/* globals task: false, fail: false, complete: false */ // Globals exposed by jake
'use strict';

var glob = require('glob');
var smplBuild = require('smpl-build-test');

task('test', ['lint', 'doc']);

task('lint', [], {async: true}, function() {
	var files = glob.sync('{' +
		__dirname + '/*.js,' +
		__dirname + '/*.json,' +
		__dirname + '/src/**/*.js,' +
		__dirname + '/src/**/*.json' +
	'}');
	
	var options = {
		files: files,
		js: {
			options: {
				node: true
			}
		},
		fileConfig: {}
	};
	options.fileConfig[__dirname + '/src/jshint.json'] = {
		options: {
			comments: true
		}
	};
	
	smplBuild.lint(options, function(err) {
		if (err) fail();
		else complete();
	});
});

task('doc', [], {async: true}, function() {
	smplBuild.document({
		paths: [__dirname + '/src'],
		outdir: __dirname + '/docs',
		basePath: __dirname,
		project: {
			dir: __dirname,
			logo: '../logo.png'
		}
	}, function(err) {
		if (err) fail();
		else complete();
	});
});

