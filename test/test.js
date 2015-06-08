var mocha = require('mocha');
var chai = require("chai");
var should = chai.should();
chai.use(require('chai-things'));
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var NestedIntervalTree = require('../');

var NodeSchema = new Schema();
NodeSchema.plugin(NestedIntervalTree);
var Node = mongoose.model('Node', NodeSchema);

var verifyPath = function (segments, node, cb) {
  if (segments.length == 0) return cb();
  var segment = segments.pop();
  segment.should.equal(node.name);
  node.parent(function (err, parent) {
    if (err) return cb(err);
    verifyPath(segments, parent, cb);
  });
}

describe('nested interval tree', function() {
  before(function(done) {
    mongoose.connect('mongodb://localhost/nested-interval-tree', function (err) {
      if (err) throw err;
      done();
    });
  });

  describe('intial node creation', function() {
    beforeEach(function(done) {
      mongoose.connection.collections['nodes'].drop( function (err) {  // wipe database before testing
        if (err) throw err;
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
            par._children.should.include.include.something.that.deep.equals(node._id);
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
            par.intervalTree.root.leftPoints.should.include.include.something.that.deep.equals([2, 2, node._id]);
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
            par.intervalTree.root.leftPoints.should.include.include.something.that.deep.equals([2, 10, node._id]);
            done();
          });
        });
      });
    });
  });
  describe('path creation', function() {
    before(function(done) {
      mongoose.connection.collections['nodes'].drop( function (err) {
        if (err) throw err;
        Node.initialize(Node, function (err, root) {
          if (err) throw err;
          done();
        });
      });
    });

    it('simple path creation', function (done) {
      Node.createPath(Node, 'test', function (err, node) {
        if (err) return done(err);
        verifyPath('test'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('long string path', function (done) {
      Node.createPath(Node, 'str1\\str2\\str3', function (err, node) {
        if (err) return done(err);
        verifyPath('str1\\str2\\str3'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('numerical path', function (done) {
      Node.createPath(Node, '4', function (err, node) {
        if (err) return done(err);
        verifyPath('4'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('long numerical path', function (done) {
      Node.createPath(Node, '4\\3\\2\\1', function (err, node) {
        if (err) return done(err);
        verifyPath('4\\3\\2\\1'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('numerical range path', function (done) {
      Node.createPath(Node, '4-18', function (err, node) {
        if (err) return done(err);
        verifyPath('4-18'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('long numerical range path', function (done) {
      Node.createPath(Node, '1-3\\3-4\\6-7', function (err, node) {
        if (err) return done(err);
        verifyPath('1-3\\3-4\\6-7'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });

    it('mixed path', function (done) {
      Node.createPath(Node, '1-3\\test\\4\\asdf\\jkl\\2-14', function (err, node) {
        if (err) return done(err);
        verifyPath('1-3\\test\\4\\asdf\\jkl\\2-14'.split('\\'), node, function (err) {
          if (err) return done(err);
          done();
        });
      });
    });
  });
});

