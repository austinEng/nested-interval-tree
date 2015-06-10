'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var IntervalTree = require('./lib/interval-tree.js');
var async = require('async');

module.exports = exports = function nestedIntervalTree (schema, options) {
  var DELIMITER = options && options.delimiter || '\\';
  schema.add({
    _parent: { // parent node
      type: Schema.ObjectId,
      index: true
    },
    _children: [Schema.ObjectId], // children nodes
    _childrenNames: [String],
    _intervalTreeParent: {
      type: Schema.ObjectId,
      index: true
    },
    _left: Number,
    _right: Number,
    intervalTree: {},
    _path: { // path to the node in the tree
      type: String,
      index: true
    },
    _root: Boolean,
    name_path: {
      type: String,
      trim: true
    },
    name: {
      type: String,
      trim: true
    }
  });

  var isNumber = function(str) {
    return !isNaN(str);
  }

  var isNumberRange = function(str) {
    var patt = new RegExp('^\\s*(\\d*\.?\\d+)\\s*-\\s*(\\d*\.?\\d+)\\s*$');
    var match = patt.exec(str);
    if (match) {
      return [match[1], match[2]];
    } else {
      return false;
    }
  }

  var hasIntervalTree = function(node) {
    var hasTree = false;
    for (var key in node.intervalTree) {
      hasTree = true;
      break;
    }
    return hasTree;
  }

  schema.pre('save', function (next) {
    var that = this;
    var continueSave = (function (root) {
      if (root) {
        if (isNumber(this.name)) {
          this._parent = root._id;
          root.intervalTree.insert([+this.name, +this.name, this._id]);
          root.markModified('intervalTree');
          root.save(function (err) {
            if (err) return next(err);
            return continueSave2(root);
          });
        } else if (isNumberRange(this.name)) {
          var range = isNumberRange(this.name);
          this._parent = root._id;
          root.intervalTree.insert([+range[0], +range[1], this._id]);
          root.markModified('intervalTree');
          root.save(function (err) {
            if (err) return next(err);
            return continueSave2(root);
          });
        } else {
          this._parent = root._id;
          root._children.push(this._id);
          root._childrenNames.push(this.name);
          root.save(function (err) {
            if (err) return next(err);
            return continueSave2(root);
          });
        }
      } else {
        this.model(this.constructor.modelName).findOne({_id: this._parent}, function (err, node) {;
          if (err) return next(err);
          return continueSave2(node);
        });
      }
    }).bind(this);

    var continueSave2 = (function (parent) {
      if (parent) {
        this._path = parent._path + DELIMITER + this._id;
        this.name_path = parent.name_path + DELIMITER + this.name;
      }
      if (isNumber(this.name)) {
        this._left = this._right = +this.name;
      } else if (isNumberRange(this.name)) {
        var range = isNumberRange(this.name);
        this._left = range[0];
        this._right = range[1];
      }
      next();
    }).bind(this);

    if (!this._root) {
      this.model(this.constructor.modelName).findOne({}, function (err, node) {
        if (err) return next(err);
        if (!node) {
          // create root document
          var node = new that.constructor({
            _root: true,
            intervalTree: IntervalTree.create([]),
            name: "root"
          });
          node.save(function (err) {
            if (err) return next(err);
            return continueSave(node);
          });
        } else {
          return continueSave();
        }
      });
    } else {
      if (this.isNew) {
        this._path = this._id;
        this.name_path = this.name;
      }
      return next();
    }
  });

  schema.statics.initialize = function (model, cb) {
    var node = new model({
      _root: true,
      intervalTree: IntervalTree.create([]),
      name: "root"
    });
    node.save(function (err) {
      if (err) return cb(err, null);
      model.root = node;
      return cb(null, node);
    });
  }

  function reportLeftRange(arr, hi, intervalCB, finishCB) {
    var fns = [];
    for(var i=0; i<arr.length && arr[i][0] <= hi; ++i) {
      fns.push(function (finish) { intervalCB(arr[i], finish)});
    }
    async.parallel(fns, function (err, nodes) {
      if (err) return finishCB(err, null);
      return finishCB(null, nodes);
    });
  }

  function reportRightRange(arr, lo, intervalCB, finishCB) {
    var fns = [];
    for(var i=arr.length-1; i>=0 && arr[i][1] >= lo; --i) {
      fns.push(function (finish) { intervalCB(arr[i], finish)});
    }
    async.parallel(fns, function (err, nodes) {
      if (err) return finishCB(err, null);
      return finishCB(null, nodes);
    });
  }

  function reportRange(arr, intervalCB, finishCB) {
    var fns = [];
    for(var i=0; i<arr.length; ++i) {
      fns.push(function (finish) {intervalCB(arr[i-1], finish)});
    }
    async.parallel(fns, function (err, nodes) {
      if (err) return finishCB(err, null);
      return finishCB(null, nodes);
    });
  }

  var queryInterval = function(intervalNode, lo, hi, intervalCB, finishCB) {
    if (!intervalNode) {
      return finishCB(null, []);
    }
    var fns = [];
    if (lo < intervalNode.mid && intervalNode.left) {
      fns.push(function (finish) {
        queryInterval(intervalNode.left, lo, hi, intervalCB, function (err, nodes) {
          if (err) return finish(err, null);
          return finish(null, nodes);
        }
      )});
    }
    if (hi > intervalNode.mid && intervalNode.right) {
      fns.push(function (finish) {
        queryInterval(intervalNode.right, lo, hi, intervalCB, function (err, nodes) {
          if (err) return finish(err, null);
          return finish(null, nodes);
        });
      });
    }
    if (hi < intervalNode.mid) {
      fns.push(function (finish) {
        reportLeftRange(intervalNode.leftPoints, hi, intervalCB, function (err, nodes) {
          if (err) return finish(err, null);
          return finish(null, nodes);
        });
      });
    } else if (lo > intervalNode.mid) {
      fns.push(function (finish) {
        reportRightRange(intervalNode.rightPoints, lo, intervalCB, function (err, nodes) {
          if (err) return finish(err, null);
          return finish(null, nodes);
        });
      });
    } else {
      fns.push(function (finish) {
        reportRange(intervalNode.leftPoints, intervalCB, function (err, nodes) {
          if (err) return finish(err, null);
          return finish(null, nodes);
        });
      });
    }
    async.parallel(fns, function (err, nodes) {
      if (err) return finishCB(err, null);
      nodes = nodes.reduce(function (a, b) {
        return a.concat(b);
      });
      return finishCB(null, nodes);
    });
  }

  var getIntervals = function(intervalTree, cb) {
    var intervals = [];
    var recurse = function(node, cb) {
      intervals = intervals.concat(node.leftPoints);
      if (node.left) {
        recurse(node.left);
      }
      if (node.right) {
        recurse(node.right);
      }
    }
    if (intervalTree.root) {
      recurse(intervalTree.root);
    } else {
      return [];
    }
    return intervals;
  }

  var getOverlappingIds = function(node, cb) {
    var ids = [];
    var fns = [];
    if (hasIntervalTree(node)) {
      fns.push(function (callback) {
        queryInterval(node.intervalTree.root, Number.MIN_VALUE, Number.MAX_VALUE, function (interval, finish) {
          finish(null, interval);
        }, function (err, intervals) {
          if (err) return callback(err, null);
          var intervalIds = intervals.map(function (node) {
            return node[2];
          });
          return callback(null, intervalIds);
        });
      });
    }
    node.model(node.constructor.modelName).findOne({_id: node._parent}, function (err, par) {
      if (err) return cb(err, null);
      if (par && hasIntervalTree(par) && typeof node._left != 'undefined') {
        fns.push(function (callback) {
          queryInterval(par.intervalTree.root, node._left, node._right, function (interval, finish) {
            finish(null, interval);
          }, function (err, intervals) {
            if (err) return callback(err, null);
            var intervalIds = intervals.map(function (node) {
              return node[2];
            });
            return callback(null, intervalIds);
          });
        });
      }
      if (fns.length > 0) {
        async.parallel(fns, function (err, ids) {
          if (ids.length == 1) {
            ids = ids[0];
          } else {
            ids = ids.reduce(function (a, b) {
              return a.concat(b);
            });
          }
          return cb(null, ids);
        });
      } else {
        return cb(null, ids);
      }
    });
  }

  // retreive nodes overlapping a node
  schema.methods.overlapping = function (cb) {
    getOverlappingIds(this, function(err, ids) {
      if (err) return cb(err, null);
      var filter = { _id : { $in : ids } };
      return this.model(this.constructor.modelName).find(filter, cb);
    });
  }

  // retreive a node's children and overlapping intervals
  schema.methods.children = function (cb) {
    var ids = this._children;
    var that = this;
    getOverlappingIds(this, function (err, overlaps) {
      if (err) return cb(err, null);
      ids = ids.concat(overlaps);
      var filter = { _id : { $in : ids } };
      return that.model(that.constructor.modelName).find(filter, cb);
    });
  }

  // retreive a node's descendants and all overlapping intervals of them
  // this is not particularly efficient
  schema.methods.descendants = function (cb) {
    var descendants = [];
    var ids = this._children;
    getOverlappingIds(this, function (err, overlaps) {
      if (err) return cb(err, null);
      ids = ids.concat(overlaps);
      var filter = { _id : { $in : ids } };

      var recurse = function (err, nodes, cb) {
        if (err) return cb(err, null);
        if (nodes.length == 0) return cb(null, descendants);
        for (var i = 0; i < nodes.length; i++) {
          descendants.push(nodes[i]);
          ids = nodes[i]._children;
          getOverlappingIds(nodes[i], function (err, overlaps) {
            if (err) return cb(err, null);
            ids = ids.concat(overlaps);
            filter = { _id : { $in : ids } };
            nodes[i].model(nodes[i].constructor.modelName).find(filter, function (err, nodes) {
              return recurse(err, nodes, cb);
            });
          });
        }
      }

      this.model(this.constructor.modelName).find(filter, function (err, nodes) {
        return recurse(err, nodes, cb);
      });
    });
  }

  // retreive a node's parent
  schema.methods.parent = function (cb) {
    return this.model(this.constructor.modelName).findOne({ _id : this._parent }, cb);
  }

  // retreive a node's ancestors
  schema.methods.ancestors = function (cb) {
    if(this.path) {
      var ids = this.path.split(DELIMITER);
      ids.pop();
    } else {
      var ids = [];
    }
    var filter = { _id : { $in : ids } };
    return this.model(this.constructor.modelName).find(filter, cb);
  }

  var followPath = function (node, segments, cb) {
    if (segments.length == 0) {
      return cb(null, node);
    }
    var segment = segments.shift();
    var number = isNumber(segment);
    var range = isNumberRange(segment);
    if (number || range) {
      if (hasIntervalTree(node)) {
        var intervals = getIntervals(node.intervalTree);
        var left;
        var right;
        if (number) {
          left = +segment;
          right = +segment;
        } else {
          left = +range[0];
          right = +range[1];
        }
        var contains = false;
        for (var i = 0; i < intervals.length; i++) {
          if (intervals[i][0] == left && intervals[i][1] == right) {
            contains = true;
            node.model(node.constructor.modelName).findOne({ _id : intervals[i][2] }, function (err, node) {
              if (err) return cb(err, null);
              return followPath(node, segments, cb);
            });
          }
        }
        if (!contains) {
          segments.unshift(segment);
          return cb(null, false, node, segments);
        }
      } else {
        segments.unshift(segment);
        return cb(null, false, node, segments);
      }
    } else {
      var contains = false;
      for (var i = 0; i < node._childrenNames.length; i++) {
        if (node._childrenNames[i] == segment) {
          contains = true;
          node.model(node.constructor.modelName).findOne({ _id : node._children[i] }, function (err, node) {
            if (err) return cb(err, null);
            return followPath(node, segments, cb);
          });
        }
      }
      if (!contains) {
        segments.unshift(segment);
        return cb(null, false, node, segments);
      }
    }
  }

  schema.statics.findPath = function (model, path, cb) {
    var segments = path.split(DELIMITER);
    return followPath(model.root, segments, cb);
  }

  var followAndCreatePath = function (last, remaining, cb) {
    if (remaining.length == 0) return cb(null, last);
    var segment = remaining.shift();
    var node = new last.constructor({
      name: segment,
      intervalTree: IntervalTree.create([])
    });
    if (isNumber(segment)) {
      node._left = +segment;
      node._right = +segment;
    } else if (isNumberRange(segment)) {
      var range = isNumberRange(segment);
      node._left = +range[0];
      node._right = +range[1];
    }
    last.addChild(node, function (err) {
      if (err) return cb(err, null);
      return followAndCreatePath(node, remaining, cb);
    });
  }

  schema.statics.createPath = function (model, path, cb) {
    schema.statics.findPath(model, path, function (err, node, last, remaining) {
      if (err) return cb(err, null);
      if (node) {
        model.findOne({_id: node._parent}, function (err, par) {
          if (err) return cb(err, null);
          par.addChild(node, function (err) {
            if (err) return cb(err, null);
            cb(null, node);
          })
        });
      }
      if (last) {
        return followAndCreatePath(last, remaining, cb);
      }
    });
  }

  schema.methods.addChild = function (node, cb) {
    var par = this;
    if (isNumber(node.name) || isNumberRange(node.name)) {
      node._parent = this._id;
      if (!hasIntervalTree(this)) {
        this.intervalTree = IntervalTree.create([]);
      }
      //this.intervalTree.insert([node._left, node._right, node._id]);
      IntervalTree.tproto.insert.call(this.intervalTree, [node._left, node._right, node._id]);
      this.markModified('intervalTree');
    } else {
      node._parent = this._id;
      this._children.push(node._id);
      this._childrenNames.push(node.name);
    }
    async.parallel([
      function(callback) {
        par.save(function (err) {
          if (err) return cb(err);
          callback();
        });
      },
      function(callback) {
        node.save(function (err) {
          if (err) return cb(err);
          callback();
        });
      }
    ], function (err, results) {
      if (err) return cb(err);
      return cb();
    });
  }

  schema.statics.findOrCreatePath = function (model, path, cb) {
    schema.statics.findPath(model, path, function (err, node, last, remaining) {
      if (err) return cb(err, null);
      if (node) return cb(null, node);
      if (last) return followAndCreatePath(last, remaining, cb);
    });
  }

  schema.statics.removePath = function (model, path, cb) {
    schema.statics.findPath(model, path, function (err, node, last, remaining) {
      if (err) return cb(err);
      if (node) return node.remove(cb);
    });
  }

  var countChildren = function(node) {
    count = 0;
    count += node._children.length;
    if (hasIntervalTree(node)) {
      count += node.intervalTree.root.count;
    }
    return count;
  }

  schema.methods.removeNode = function (cb) {
    this.model(this.constructor.modelName).findOne({ _id : this._parent }, function (err, par) {
      if (err) return cb(err);
      if (isNumber(this.name) || isNumberRange(this.isNumberRange)) {
        par.intervalTree.remove([this._left, this._right, this._id]);
        par.markModified('intervalTree');
        this.remove(function(err) {
          if (err) return cb(err);
          if (countChildren(par) == 0) {
            par.removeNode(cb);
          } else {
            par.save(function (err) {
              if (err) return cb(err);
              cb();
            });
          }
        });
      } else {
        var index = par._childrenNames.indexOf(this.name);
        par._childrenNames.splice(index, 1);
        par._children.splice(index, 1);
        this.remove(function(err) {
          if (err) return cb(err);
          if (countChildren(par) == 0) {
            par.removeNode(cb);
          } else {
            par.save(function (err) {
              if (err) return cb(err);
              cb();
            });
          }
        });
      }
    });
  }
}