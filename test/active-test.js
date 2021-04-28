/*
 * test/active-test.js
 * 
 * @see   http://visionmedia.github.com/mocha/
 * @see   http://nodejs.org/docs/v0.4.8/api/assert.html
 */

'use strict';

var assert = require('assert');
// var log = require('pino')();

var Active = require('../lib/active.js');

describe("Active", function() {

  describe("<#method#>", function() {
    this.timeout(60e3);
    
    class T extends Active {
      constructor(indent) {
        super();
        this.indent = indent;
      }
      async _attach() {
        // log.info("%s#mg[\\] #gr[%s] _attach", this.indent, this);
        await super._attach();
        if (this.throws == '_attach') throw new Error("ERROR");
        // log.info("%s#mg[/] #gr[%s] _attach", this.indent, this);
      }
      async _detach() {
        // log.info("%s#mg[\\] #gr[%s] _detach", this.indent, this);
        await super._detach();
        if (this.throws == '_detach') throw new Error("ERROR");
        // log.info("%s#mg[/] #gr[%s] _detach", this.indent, this);
      }
      async _start() {
        // log.info("%s#mg[\\] #gr[%s] _start", this.indent, this);
        await super._start();
        if (this.throws == '_start') throw new Error("ERROR");
        // log.info("%s#mg[/] #gr[%s] _start", this.indent, this);
      }
      async _stop() {
        // log.info("%s#mg[\\] #gr[%s] _stop", this.indent, this);
        await super._stop();
        if (this.throws == '_stop') throw new Error("ERROR");
        // log.info("%s#mg[/] #gr[%s] _stop", this.indent, this);
      }
    }
    
    class A extends T {}
    class B extends T {}
    class C extends T {}
        
    let a1, b1, b2, c1, c2, c3, c4;
    
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

    it("should handle start-stop-detach-attach-start-detach", async function() {
      [a1, b1, b2, c1, c2, c3, c4].forEach(function(a) {
        a.on('status', report.bind(a));
      });
      function report(event) {
        // log.info("%s#bmg[%s] #yl[%s]", this.indent, event, this);
      }

      // log.info("#bcy[Starting]");
      await a1.start();
      // log.info("#bcy[Stopping]");
      await a1.stop();
      // log.info("#bcy[Detaching]");
      await a1.detach();
      // log.info("#bcy[Attaching]");
      await a1.attach();
      // log.info("#bcy[Starting]");
      await a1.start();
      // log.info("#bcy[Detaching]");
      await a1.detach();
    });
    
    it("should be able to be interrupted", async function() {
      [a1, b1, b2, c1, c2, c3, c4].forEach(function(a) {
        a.on('status', reportStatus.bind(a));
        a.on('error', reportError.bind(a));
      });
      function reportStatus(event) {
        // log.info("%s#bmg[%s] #yl[%s]", this.indent, event, this);
      }
      function reportError(error, action) {
        // log.info("%s#rd[error] #yl[%s] #wh[%s] #byl[%s]", this.indent, this, action, error);
      }

      // log.info("^#bmg[M1] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
      
      c2.throws = '_start';
      // log.info("^#bmg[START with c2 throws on _start()]");
      try {
        await a1.start();

      } catch (error) {
        // log.info("^^#byl[%s]", err.stack);

      } finally {
        // log.info("^#bmg[M2] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
      
        // log.info("^#bmg[DETACH]");
        delete(c2.throws);
        try {
          await a1.detach();
        } catch (error) {
          // log.info("^^#byl[%s]", err.stack);
        } finally {
          // log.info("^#bmg[M4] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
      
          try {
            // log.info("^#bmg[STOP]");
            await a1.stop();
          } catch (error) {
            // log.info("^^#byl[%s]", err.stack);
          } finally {
            // log.info("^#bmg[M4] #bcy[A #df[%s]  B #df[%s] #df[%s]  C #df[%s] #df[%s] #df[%s] #df[%s]]", a1, b1, b2, c1, c2, c3, c4);
      
            // log.info("^#bmg[STOP]");
            return a1.stop();
  
          }
        }
      }
    });
    
  });

});

