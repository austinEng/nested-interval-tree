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
});

