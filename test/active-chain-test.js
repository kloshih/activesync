
const { expect } = require('chai');

const Active = require('../lib/active')

describe("Active Chain", () => {

  describe("Chaining", () => {

    class Api extends Active {
      static get props() {
        return {
          url: { type:'url', implicit:true },
        }
      }
    }

    class End extends Api {
      static provides(config, owner, base) {
        const url = config.url;
        if (url.scheme == 'end')
          return { priority:10 }
      }
      static sharedProviderKey(config) {
        return config.url.format({ path:null, query:null, fragment:null })
      }
      static get props() {
        return {
          url: { protocols:['end'] }
        }
      }
      sum(a, b) {
        return a + b;
      }
    }
    Api.use(End);

    class Sub extends Api {
      static provides(config, owner, base) {
        const url = config.url;
        if (url.scheme == 'sub')
          return { priority:10, url:url.format({authority:null, next:url.format({ scheme:'end', path:null })}) }
      }
      static get props() {
        return {
          url: { protocols:['sub'] }
        }
      }
      sum(a, b) {
        return this.next.sum(a, b) * 2;
      }
    }
    Api.use(Sub);

    it("can chain actives using URL", async () => {
      const sub = Api.provider('sub://localhost:1234/a/b');
      expect(sub).to.be.an('object');
      expect(sub.next).to.be.an('object');
      expect(sub.next.prevs.includes(sub)).to.be.true;
      expect(sub.sum(1, 2)).to.be.equal(6);
      // console.log(sub.dump());
    })

    it("can chain actives to shared actives", async () => {
      const sub1 = Api.provider('sub://localhost:1234/a/1');
      const sub2 = Api.provider('sub://localhost:1234/b/2');
      expect(sub1).to.not.eq(sub2);
      expect(sub1.next).to.eq(sub2.next);
      const end = sub1.next;
      expect(end.prevs).to.be.an('array');
      expect(end.prevs.includes(sub1)).to.true
      expect(end.prevs.includes(sub2)).to.true
    })

    it("can start and stop chains", async () => {
      const sub = Api.provider('sub://localhost:1234/a/b');
      expect(sub).to.be.an('object');
      expect(sub.next).to.be.an('object');
      // console.log(sub.dump());
    })

  })

})