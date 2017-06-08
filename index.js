'use strict';
var assign = require('deep-assign');
var dirtree = require('dirtree');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var watch = require('watch');

/*
	assignJSONfile - parse contents of JSON file and insert it to key of `obj` by `relPath`
	Arguments:
	+ relPath - relative (to root) path to JSON file
	+ separator - directories separator used in `relPath`
	+ absPath - accessive real path to JSON file
	+ obj - tree object to assign the key to
*/
function assignJSONfile(relPath, separator, absPath, obj) {
	try { var additive = JSON.parse(fs.readFileSync(absPath)); }
	catch (e) { return false;}
	var bases = relPath.split(separator);
	for (let depth = bases.length - 1; depth >=0; depth--) {
		additive = { [bases[depth]]: additive };
	}
	assign(obj, additive);
	return true;
}

/*
	deleteByRelPath - find a key from `obj` by `relPath` and delete it
	Arguments:
	+ relPath - relative (to root) path to JSON file
	+ separator - directories separator used in `relPath`
	+ obj - tree object to delete the key from
*/
function deleteByRelPath(relPath, separator, obj) {
	var bases = relPath.split(separator);
	var additive = 'delete obj';
	for (let depth = 0; depth < bases.length; depth++) {
		additive += '["'+ bases[depth] +'"]';
	}
	try { eval(additive); }
	catch (e) { return false; }
	return true;
}

function stringify(obj, prettify) {
	return prettify ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
}

/*
	DB - Initial function, start watching whole storage for changes, returns object with `tree`
	Arguments:
	+ obj - initial settings
		Required key is `root` is absolute path to storage
		Optional key `instantPush` sets whether any change will be applied to storage instantly
		Optional key `liveIgnore` sets whether changes in filesystem will be ignored (default: false)
		Optional key `pathSep` sets separator for relative paths in tree (default: '/')
		Optional key `unwatch` sets whether watcher is not supposed to be used
		Optional key `watch` represents options for watcher (https://www.npmjs.com/package/watch#watchwatchtreeroot-options-callback)
		Optional key `prettify` sets whether to write pretty formatted json til files
*/
var DB = module.exports = function DB(obj) {
	if (!(this instanceof DB)) {
        return new DB(obj);
    }
	this.liveIgnore = false;
	this.pathSep = '/';
	this.prettify = true;
	Object.assign(this, obj);
	this.root = path.resolve(this.root);

	this.dirtree = dirtree();
	this.fetch();

	if (!this.unwatch) {
		var liveCallback = (f, curr, prev) => {
			if (!this.liveIgnore && !(typeof f == 'object' && prev === null && curr === null) && path.extname(f) == '.json') {
				var relPath = f.substr(this.root.length + 1);
				if (prev === null) {// On create
					assignJSONfile(relPath, path.sep, f, this.tree);
				}
				else {// On remove or change
					deleteByRelPath(relPath, path.sep, this);
					if (curr.nlink === 0) this.fetch();// On remove
					else assignJSONfile(relPath, path.sep, f, this.tree);// On change
				}
			}
		}
		if (this.watch) watch.watchTree(this.root, this.watch, liveCallback);
		else watch.watchTree(this.root, liveCallback);
	}

	this.commits = [];
}
/*
	DB.fetch - import data from filesystem storage
*/
DB.prototype.fetch = function() {
	this.tree = {};
	this.dirtree.root(this.root).include('files', /\.json$/).create();
	for (let fn in this.dirtree._flattened) {
		assignJSONfile(fn, '/', this.dirtree._flattened[fn], this.tree);
	}
}
/*
	DB.push - do some changes in filesystem storage
*/
DB.prototype.push = function() {
	this.commits = Array.from(new Set(this.commits));// commits can't be same
	try {
		for (let n = 0; n < this.commits.length; n++) {
			if (typeof this.commits[n] === 'object') {// array given - action with files themselves
				var absPath = path.resolve(this.root, this.commits[n][1]);
				if (this.commits[n][0] === 'create') {
					if (path.extname(this.commits[n][1]) == '.json') {
						mkdirp.sync(path.dirname(absPath));
						fs.writeFileSync(absPath, stringify(this.commits[n][2]), this.prettify);
					}
				}
				else if (this.commits[n][0] === 'delete') {
					var st = fs.statSync(absPath);
					if (st.isDirectory()) {
						var dirtree = dirtree();
						dirtree.root(absPath).include('file', /\.json$/).create();
						console.log(dirtree);
						for (let fn in dirtree._flattened) {
							fs.unlink(dirtree._flattened[fn]);
						}
					}
					else fs.unlink(absPath);
				}
			}
			else {// string given, write contents to this file
				var absPath = path.resolve(this.root, this.commits[n]);
				fs.writeFileSync(absPath, stringify(this.get(this.commits[n]), this.prettify));
			}
		}
	}
	catch (e) {}
	this.commits = [];
}
/*
	DB.get - get object in tree by `relPath` or get value from it by `key`
	Arguments:
	+ relPath - relative path to file
	+ key - (optional) key to get the value of (will be evaluated)
	+ reassign - (optional) make it a new object, i.e. without reference
*/
DB.prototype.get = function(relPath, key, reassign) {
	var bases = relPath.split(this.pathSep);
	var additive = this.tree;
	if (reassign) additive = Object.assign({}, additive);
	for (let depth = 0; depth < bases.length; depth++) {
		additive = additive[bases[depth]];
		if (typeof additive === 'undefined') break;
	}
	if (key) {
		try { eval('additive = additive'+ key); }
		catch (e) { additive = undefined; }
	}
	return additive;
}
/*
	DB.set - creale file or set `key`'s value in it
	Arguments:
	+ relPath - relative path to file
	+ key - (optional) key to set the value of (will be evaluated)
	+ value - (optional) number, string, array or object (default: {})
*/
DB.prototype.set = function(relPath, key, value) {
	value = value || {};
	try {
		if (key) {
			var contents = this.get(relPath);
			contents[key] = value;
			this.commits.push(relPath);
		}
		else {
			var bases = relPath.split(this.pathSep);
			var additive = value;
			for (let depth = bases.length - 1; depth >=0; depth--) {
				additive = { [bases[depth]]: additive };
			}
			assign(this.tree, additive);
			this.commits.push(['create', relPath, value]);
		}
	}
	catch (e) { return false; }
	if (this.instantPush) this.push();
	return true;
}
/*
	DB.delete - delete JSON files in `relPath` directory or file by this path or certain `key` in file if given
	Arguments:
	+ relPath - relative path to file or directory
	+ key - (optional) key to delete from file (will be evaluated)
*/
DB.prototype.delete = function(relPath, key) {
	try {
		if (key) {
			var contents = this.get(relPath);
			eval('delete contents'+ key);
		}
		else deleteByRelPath(relPath, this.pathSep, this);
	}
	catch (e) { return false; }
	if (key) this.commits.push(relPath);
	else this.commits.push(['delete', relPath]);
	if (this.instantPush) this.push();
	return true;
}
