# jsondir-livedb

Watch your filesystem-directories-and-JSON based database, keep all data in RAM and HDD.

## Install

```
$ npm install --save jsondir-livedb
```

## API

### Constructor

```
	const LiveDB = require('jsondir-livedb');
	var DB = new LiveDB(settings);
```

Settings is the object containing these keys:

* `root` (required) - storage directory
* `instantPush` sets whether any change will be applied to storage instantly
* `liveIgnore` sets whether changes in filesystem will be ignored (default: false)
* `pathSep` sets separator for relative paths in tree (default: '/')
* `unwatch` sets whether watcher is not supposed to be used
* `watch` represents options for watcher (https://www.npmjs.com/package/watch#watchwatchtreeroot-options-callback)

## Usage example

Root folder must be in your working directory already. In example it is called `storage`.

Now you can put some files into this folder. Be it any folders with markdown and other meta files, library will touch JSON files only.

```
	const LiveDB = require('jsondir-livedb');
	var DB = new LiveDB({
		root: 'storage'
	});
```

Create, check and then delete file:
```
	if (DB.set('unnecessary/file.json')) {
		console.log('Succesfully created');
		console.log(DB.get('unnecessary/file.json')); // returns {}
		console.log(DB.tree['unnecessary']['file.json']); // returns {}
		console.log(DB.tree.unnecessary['file.json']); // returns {}
		console.log(DB.tree.unnecessary.file); // returns undefined
		if (DB.delete('unnecessary/file.json')) {
			console.log('Succesfully deleted');
		}
	}
```

Create new JSON file with initial data and log tree:
```
	DB.set('users/1/common.json', null, {
		name: 'admin',
		password: 'admin',
		class: 5
	});
	console.log(require('util').inspect(DB.tree, {colors: true, depth: 5}));
```

Add a key:
```
	DB.set('users/1/common.json', 'authKey', 'big secret');
```

Delete some key:
```
	DB.delete('users/1/common.json', 'class');
```

*All changes were made in runtime only.* So make them after few operations were made:
```
	DB.push();
```

Put a setting `instantPush: true` if you want to apply changes (`set`, `delete`) to storage instantly.
```
	...
	var DB = new LiveDB({
		root: 'storage',
		instantPush: true
	});
	...
```

So delete JSON files in `users` now and push the changes:
```
	DB.delete('users');
	DB.push();
```
Note that folders were not deleted. You can remove empty directories in your storage with tools like [ded](https://www.npmjs.com/package/ded), [remove-empty-directories](https://www.npmjs.com/package/remove-empty-directories), etc.

### Check live functionality

By default your database has ability to watch and fetch changes in runtime.

Set interval to output JSON file contents:
```
	setInterval(() => {
		var contents = DB.tree.users['1']['common.json'];
		console.log('\n'+ require('util').inspect(contents, {colors: true, depth: 5}));
	}, 5000);
```

Now make some changes in file `users/1/common.json` via any other program. See the difference.