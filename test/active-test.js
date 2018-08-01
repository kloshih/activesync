/*
 * test/active-test.js
 * 
 * @see   http://visionmedia.github.com/mocha/
 * @see   http://nodejs.org/docs/v0.4.8/api/assert.html
 */

'use strict';

var assert = require('assert');

var Class = require('classr');
var begin = require('begin');
var log = require('log');

var Active = require('../lib/active.js');
// var log = active.log();

describe("Active", function() {

  describe("<#method#>", function() {
    this.timeout(60e3);
    
    class T extends Active {
      constructor(indent) {
        super();
        this.indent = indent;
      }
      _attach() {
        var self = this, sup = super._attach;
        return begin().
          thenSync(function() {
            log('info', "%s#mg[\\] #gr[%s] _attach", self.indent, self);
          }).
          then(function() { return sup.call(self) }).
          thenSync(function() {
            if (self.throws == '_attach') throw new Error("ERROR");
            log('info', "%s#mg[/] #gr[%s] _attach", self.indent, self);
          }).
        end();
      }
      _detach() {
        var self = this, sup = super._detach;
        return begin().
          thenSync(function() {
            log('info', "%s#mg[\\] #gr[%s] _detach", self.indent, self);
          }).
          then(function() { return sup.call(self) }).
          thenSync(function() {
            if (self.throws == '_detach') throw new Error("ERROR");
            log('info', "%s#mg[/] #gr[%s] _detach", self.indent, self);
          }).
        end();
      }
      _start() {
        var self = this, sup = super._start;
        return begin().
          thenSync(function() {
            log('info', "%s#mg[\\] #gr[%s] _start", self.indent, self);
          }).
          then(function() { return sup.call(self) }).
          thenSync(function() {
            if (self.throws == '_start') throw new Error("ERROR");
            log('info', "%s#mg[/] #gr[%s] _start", self.indent, self);
          }).
        end();
      }
      _stop() {
        var self = this, sup = super._stop;
        return begin().
          thenSync(function() {
            log('info', "%s#mg[\\] #gr[%s] _stop", self.indent, self);
          }).
          then(function() { return sup.call(self) }).
          thenSync(function() {
            if (self.throws == '_stop') throw new Error("ERROR");
            log('info', "%s#mg[/] #gr[%s] _stop", self.indent, self);
          }).
        end();
      }
    }
    
    class A extends T {}
    class B extends T {}
    class C extends T {}
        
    var a1, b1, b2, c1, c2, c3, c4;
    
    beforeEach(function() {
      console.log("Creating A");
      a1 = new A('  ');
      console.log("Creating B");
      b1 = new B('    '),
      console.log("Creating B");
      b2 = new B('    ');
      console.log("Creating C");
      c1 = new C('      '),
      console.log("Creating C");
      c2 = new C('      '),
      console.log("Creating C");
      c3 = new C('      '),
      console.log("Creating C");
      c4 = new C('      ');
      a1.addSubactive(b1);
      a1.addSubactive(b2);
      b1.addSubactive(c1);
      b1.addSubactive(c2);
      b2.addSubactive(c3);
      b2.addSubactive(c4);
    });

    it("should handle start-stop-detach-attach-start-detach", function(done) {
      begin().
        then(function() {
          [a1, b1, b2, c1, c2, c3, c4].forEach(function(a) {
            a.on('status', report);
          });
          function report(event, active) {
            log('info', "%s#bmg[%s] #yl[%s]", active.indent, event, active);
          }
          
          begin().
            then(function() {
              log('info', "#bcy[Starting]");
              return a1.start();
            }).
            then(function() {
              log('info', "#bcy[Stopping]");
              return a1.stop();
            }).
            then(function() {
              log('info', "#bcy[Detaching]");
              return a1.detach();
            }).
            then(function() {
              log('info', "#bcy[Attaching]");
              return a1.attach();
            }).
            then(function() {
              log('info', "#bcy[Starting]");
              return a1.start();
            }).
            then(function() {
              log('info', "#bcy[Detaching]");
              return a1.detach();
            }).
          end(done);
        }).
      end(done);
    });
    
    it("should be able to be interrupted", function(done) {
      begin().
        then(function() {
          [a1, b1, b2, c1, c2, c3, c4].forEach(function(a) {
            a.on('status', reportStatus);
            a.on('error', reportError.bind(null, a));
          });
          function reportStatus(event, active) {
            log('info', "%s#bmg[%s] #yl[%s]", active.indent, event, active);
          }
          function reportError(active, error, action) {
            log('info', "%s#rd[error] #yl[%s] #wh[%s] #byl[%s]", active.indent, active, action, error);
          }

          log('info', "^#bmg[M1] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
          
          c2.throws = '_start';
          log('info', "^#bmg[START with c2 throws on _start()]");
          return a1.start();
        }).
        finally(function(err) {
          if (err)
            log('info', "^^#byl[%s]", err.stack);
          log('info', "^#bmg[M2] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
          
          log('info', "^#bmg[DETACH]");
          delete(c2.throws);
          return a1.detach();
        }).
        finally(function(err) {
          if (err)
            log('info', "^^#byl[%s]", err.stack);
          log('info', "^#bmg[M3] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
          
          log('info', "^#bmg[START]");
          return a1.start();
        }).
        finally(function(err) {
          if (err)
            log('info', "^^#byl[%s]", err.stack);
          log('info', "^#bmg[M4] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
          
          log('info', "^#bmg[STOP]");
          return a1.stop();
        }).
        finally(function(err) {
          if (err)
            log('info', "^^#byl[%s]", err.stack);
          log('info', "^#bmg[M5] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
          // log('info', "^^%s", a1.dump());
          return null;
        }).
      end(done);
    });
    
  });

});

