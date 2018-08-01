/*
 * test/<#file#>.js
 * 
 * @see   http://visionmedia.github.com/mocha/
 * @see   http://nodejs.org/docs/v0.4.8/api/assert.html
 */

'use strict';

var assert = require('assert');

var begin = require('begin');
var log = require('log');

var Active = require('../lib/active.js');


describe("Active prop", function() {

  describe("Using shared providers", function() {
    
    class Connection extends Active {
      static get props() {
        return {
          url: { implicit:true },
        }
      }
      static sharedProviderKey(config) {
        log('info', "config: #byl[%s]", config);
        var url = config.url || config.name;
        var match = url.match(/^([\w\+-]*)/);
        var shareKey = match[1];
        log('info', "Share key: #byl[%s]", shareKey);
        return shareKey;
      }
    }
    log.trace(Connection);
    
    class Server extends Active {
      static get props() {
        return {
          connection: { req:'1', type:Connection },
        }
      }
    }
    log.trace(Server)
    
    it.only("should be able to create using share key", function(done) {
      begin().
        then(function() {
          this.server1 = new Server({
            connection: 'httpd://0.0.0.0:3450/alpha',
          });
          return this.server1.start();
        }).
        then(function() {
          this.server2 = new Server({
            connection: 'httpd://0.0.0.0:3450/beta',
          });
          return this.server2.start();
        }).
        then(function() {
          log('info', "^^#bgr[server1]\n%s\n#bgr[server2]\n%s", this.server1.dump(), this.server2.dump());
          return null
        }).
      end(done)
    });

    
  });

  describe("Case 1", function() {
    this.timeout(60e3);
    
    class Group extends Active {
      static get props() {
        return {
          name:  { default:'name' },
          teams: { req:'*', type:() => Team },
        }
      }
      constructor(config, owner) {
        super(Object.assign({name:'test'}, config), owner);
      }
      toString() {
        return super.toString().replace(/\x29$/, ':' + this.name + '\x29')
      }
    }
    
    class Team extends Active {
      static get props() {
        return {
          name:  { default:'name' },
          staff: { req:'*', type:() => Staff },
        }
      }
      constructor(config, owner) {
        super(Object.assign({name:'test'}, config), owner);
      }
      toString() {
        return super.toString().replace(/\x29$/, ':' + this.name + '\x29')
      }
    }
    
    class Board extends Team {
      static get props() {
        return {
          chairman:{ req:'1', type:() => Staff },
        }
      }
    }
    Team.use(Board);
    
    class Staff extends Active {
      static get props() {
        return {
          name:  {},
        }
      }
      constructor(config, owner) {
        super(Object.assign({}, config), owner);
      }
      toString() {
        return super.toString().replace(/\x29$/, ':' + this.name + '\x29')
      }
    }

    class Manager extends Staff {
      static get props() {
        return {
        }
      }
    }
    Staff.use(Manager);
    
    
    it("should work", function(done) {
      var group = new Group({
        name: 'Acme Widgets',
        teams: {
          board: {
            name: 'Board',
          },
          marketing: {
            name: 'Marketing',
            staff: {
              tim: { name:'Tim Woods', type:'manager' },
              amy: { name:'Amy Wells'},
            },
          },
          technology: {
            staff: {
              mia: { name:'Mia Marcus' },
              max: { name:'Max Fisher' },
            },
          },
        },
      });
      begin().
        then(function() {
          return group.start()
        }).
        thenSync(function() {
          log('info', "Group:\n#byl[%s]", group.dump());
        }).
      end(done)
    });
    
  });

});

