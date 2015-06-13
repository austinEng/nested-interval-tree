# nested-interval-tree
A mongoose plugin implementing nested interval trees

## What is it?
Stores nodes at locations in a tree specified by delimited strings

Strings with numerical paths are stored in interval trees

#### Example
(root is an imaginary node which all are children of)

`root/this/is/a/test` is a simple path where the tree looks like: this --> is --> a --> test

`root/1`, `root/2`, `root/test/3`, `root/test/4` have numerical paths. '1' and '2' are stored in root's interval tree while '3' and '4' are stored in test's interval tree

`root/2.3-8.9` has a numerical range which is also stored in root's interval tree

All of these types can be mixed together so `root/2/test/3-4/4/5/hello/1-2/3-4/bye` is a valid path

This allows us to do some interesting queries. Suppose we had some data stored at the following location in our tree:
`somebook\1-6\stuff\otherstuff\2\3-4`

We should be able to find that data by searching the descendants of any one of these paths:
`somebook\5`
`somebook\1-3`
`somebook\0-7`
`somebook\4\stuff`
`somebook\3\stuff\otherstuff\3-8\2`

## Usage

```javascript
var mongoose = require('mongoose');
var NestedIntervalTree = require('nested-interval-tree');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/nested-interval-tree-test');

var TagSchema = new Schema();

TagSchema.plugin(NestedIntervalTree, {
  delimiter: '/'      // default: '\\'
});

// initialize the root node
Tag.initialize(Tag, function (err, rootNode) {
  // do stuff
});

// create a path and return the last node
Tag.createPath(Tag, path, function (err, node) {
  // do stuff
});

// find or create a path and return the last node
Tag.findOrCreatePath(Tag, path, function (err, node) {
  // do stuff
});

// find a path and return the last node
Tag.findPath(Tag, path, function (err, node) {
  // do stuff
});

// remove a path
Tag.removePath(Tag, path, function (err) {
  // do stuff
});

// retrieve the nodes overlapping this node in the same interval tree
tag.overlapping(function (err, nodes) {
  // do stuff
});

// retrieve all direct children and the nodes overlapping this node
// in the same interval tree
tag.children(function (err, nodes) {
  // do stuff
});

// retrieve all descendents. This includes children, overlapping nodes, all their
// children and overlapping nodes, etc.
tag.descendants(function (err, nodes) {
  // do stuff
});

// retrieve a node's parent. For numerical nodes, this is not the containing interval
// but rather the node to which the interval tree belongs
tag.parent(function (err, node) {
  // do stuff
});

// retrieve all ancestors of a node
tag.ancestors(function (err, nodes) {
  // do stuff
});

// add a node as a child of another
tag.addChild(node, function (err) {
  // do stuff
});

// remove a node
tag.removeNode(function (err) {
  // do stuff
});

// get overlapping nodes, all ancestors and their overlapping nodes
tag.getRelated(function (err, nodes) {
  // do stuff
});

var Tag = mongoose.model('Tag', TagSchema);
```