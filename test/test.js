var mocha = require('mocha');
var chai = require("chai");
var should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chaid'));
chai.config.truncateThreshold = 0;
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var NestedIntervalTree = require('../');
var NodeSchema = new Schema();
NodeSchema.plugin(NestedIntervalTree);
var Node = mongoose.model('Node', NodeSchema);
var async = require('async');

describe('nested interval tree', function() {
  before(function(done) {
    mongoose.connect('mongodb://localhost/nested-interval-tree', function (err) {
      if (err) return done(err);
      done();
    });
  });

  describe('intial node creation', function() {
    beforeEach(function(done) {
      mongoose.connection.collections['nodes'].drop( function (err) {  // wipe database before testing
        if (err) return done(err);
        done();
      });
    });

    describe('of type string', function() {
      it('should create root node and parent to it', function(done) {
        var node = new Node({name: "name"});
        node.save(function (err) {
          if (err) return done(err);
          should.exist(node._parent);
          Node.findOne({_id: node._parent}, function (err, par) {
            if (err) return done(err);
            should.exist(par);
            par._children.should.include.something.that.deep.equals(node._id);
            done();
          });
        })
      });
    });

    describe('of type number', function() {
      it('should create root node and parent to it', function(done) {
        var node = new Node({name: "2"});
        node.save(function (err) {
          if (err) return done(err);
          should.exist(node._parent);
          Node.findOne({_id: node._parent}, function (err, par) {
            if (err) return done(err);
            should.exist(par);
            par.intervalTree.root.leftPoints.should.include.something.that.deep.equals([2, 2, node._id]);
            done();
          });
        });
      });
    });

    describe('of type number range', function() {
      it('should create root node and parent to it', function(done) {
        var node = new Node({name: "2-10"});
        node.save(function (err) {
          if (err) return done(err);
          should.exist(node._parent);
          Node.findOne({_id: node._parent}, function (err, par) {
            if (err) return done(err);
            should.exist(par);
            par.intervalTree.root.leftPoints.should.include.something.that.deep.equals([2, 10, node._id]);
            done();
          });
        });
      });
    });
  });

  describe('path creation', function() {
    before(function (done) {
      mongoose.connection.collections['nodes'].drop( function (err) {
        if (err) throw err;
        Node.initialize(Node, function (err, root) {
          if (err) throw err;
          return done();
        });
      });
    });

    var verifyPath = function (segments, node, cb) {
      if (segments.length == 0) return cb();
      var segment = segments.pop();
      segment.should.equal(node.name);
      node.parent(function (err, parent) {
        if (err) return cb(err);
        parent.children(function (err, children) {
          if (err) return cb(err);
          var childrenIds = children.map(function (node) {return node._id});
          childrenIds.should.include.something.that.eqls(node._id);
          return verifyPath(segments, parent, cb);
        });
      });
    }

    it('simple path creation', function (done) {
      var path = 'test';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          return done();
        });
      });
    });

    it('long string path', function (done) {
      var path = 'str1\\str2\\str3';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          return done();
        });
      });
    });

    it('numerical path', function (done) {
      var path = '4';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          return done();
        });
      });
    });

    it('long numerical path', function (done) {
      var path = '4\\3\\2\\1';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('numerical range path', function (done) {
      var path = '4-18';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('long numerical range path', function (done) {
      var path = '1-3\\3-4\\6-7';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('mixed path', function (done) {
      var path = '1-3\\test\\4\\asdf\\jkl\\2-14';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('findOrCreate - existing', function (done) {
      var path = '1-3\\test\\4\\asdf\\jkl\\2-14\\hi';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        Node.findOrCreatePath(Node, path, function (err, found) {
          node._id.should.eql(found._id);
          verifyPath(path.split('\\'), node, function (err) {
            if (err) return done(err);
            done();
          });
        });
      });
    });

    it('findOrCreate - new', function (done) {
      var path = '1-3\\test\\4\\asdf\\jkl\\5\\hey';
      Node.findOrCreatePath(Node, path, function (err, node) {
        verifyPath(path.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });
  });

  describe('children and descendants', function() {
    before(function (done) {
      mongoose.connection.collections['nodes'].drop( function (err) {
        if (err) throw err;
        Node.initialize(Node, function (err, root) {
          if (err) throw err;
          async.series([
            function (callback) {
              Node.createPath(Node, 'this\\is\\a\\test\\path', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'this\\is\\another\\test\\path', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'this\\is\\another\\test\\path\\yet\\again', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'test\\1-5', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'test\\2-18', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'test\\4', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'test\\1-5\\hey', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'test\\2-18\\what\'s', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            },
            function (callback) {
              Node.createPath(Node, 'test\\4\\up', function (err, node) {
                if (err) return callback(err);
                callback(null, node);
              });
            }
          ], function (err, res) {
            if (err) throw err;
            return done();
          });
        });
      });
    });

    it ('simple children', function (done) {
      Node.findPath(Node, 'this\\is', function (err, node) {
        if (err) return done(err);
        node.children(function (err, nodes) {
          nodes.length.should.equal(2);
          done();
        });
      });
    });

    it ('numerical children', function (done) {
      Node.findPath(Node, 'test', function (err, node) {
        if (err) return done(err);
        node.children(function (err, nodes) {
          nodes.length.should.equal(3);
          done();
        });
      });
    });

    it ('overlap children', function (done) {
      Node.findPath(Node, 'test\\4', function (err, node) {
        if (err) return done(err);
        node.children(function (err, nodes) {
          nodes.length.should.equal(3);
          done();
        });
      });
    });

    it ('descendants', function (done) {
      Node.findPath(Node, 'test', function (err, node) {
        if (err) throw err;
        node.descendants(function (err, nodes) {
          if (err) return done(err);
          nodes.length.should.equal(6);
          done();
        });
      });
    });
  });

  describe('path removal', function() {
    before(function (done) {
      mongoose.connection.collections['nodes'].drop( function (err) {
        if (err) throw err;
        Node.initialize(Node, function (err, root) {
          if (err) throw err;
          return done();
        });
      });
    });

    it ('bubbles up if parent becomes empty', function (done) {
      var path = 'this\\is\\3-4\\a\\test\\path\\4\\1-3\\2\\numbers';
      Node.createPath(Node, path, function (err, node) {
        if (err) return done(err);
        Node.removePath(Node, path, function (err) {
          if (err) return done(err);
          Node.root._children.length.should.equal(0);
          done();
        });
      });
    });
  });

  describe('performance', function () {
    var insertFns = [];
    var findFns = [];
    var strings = ['this', 'is', 'a', 'test', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    var trials = 500;
    var maxLen = 10;

    before(function (done) {
      mongoose.connection.collections['nodes'].drop( function (err) {
        if (err) throw err;
        Node.initialize(Node, function (err, root) {
          if (err) throw err;

          for (var i = 0; i < trials; i++) {
            var pathLength = Math.floor(Math.random() * maxLen + 1);
            var path = [];
            for (var j = 0; j < pathLength; j++) {
              var str = strings[Math.floor(Math.random()*strings.length)];
              path.push(str);
            }
            path = path.join('\\');
            insertFns.push(function (callback) {
              Node.findOrCreatePath(Node, path, function (err, node) {
                callback();
              });
            });
          }

          for (var i = 0; i < trials; i++) {
            var pathLength = Math.floor(Math.random() * maxLen + 1);
            var path = [];
            for (var j = 0; j < pathLength; j++) {
              var str = strings[Math.floor(Math.random()*strings.length)];
              path.push(str);
            }
            path = path.join('\\');
            findFns.push(function (callback) {
              Node.findPath(Node, path, function (err, node) {
                callback();
              });
            });
          }

          return done();
        });
      });
    });

    it (trials + ' insertions in series', function (done) {
      async.series(insertFns, function (err, res) {
        if (err) return done(err);
        done();
      });
    });

    it (trials + ' lookups in series', function (done) {
      async.series(findFns, function (err, res) {
        if (err) return done(err);
        done();
      });
    });

    it (trials + ' lookups in parallel', function (done) {
      async.parallel(findFns, function (err, res) {
        if (err) return done(err);
        done();
      });
    });
  });
});

