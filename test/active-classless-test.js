
const { expect } = require('chai');

const Active = require('../lib/active')

describe("Active", () => {

  describe("Basic functionality", () => {

    it("can do something", async () => {

      // interface IPriceFeed {

      //   markets: PriceFeedMarket[],
      //   api: RestAPI,
        
      // }

      const PriceFeed = defineActive({
        props: {
          markets: { many:PriceFeedMarket },
          api: { one:RestAPI },
        },
        impl: {
          async _start() {
            await super._start();
            this.creds = await api.basicAuth({ user:'abc', token:'def'});
          }
        }
      });

      feed = new PriceFeed(config);

      const Service = struct({
        extends: [
          Runnable,
        ],
        props: {
        },
        methods: {
        },
        events: {
        },
        impl: {
          _start() {
          }
        }
      });

      interface PriceFeed {
      }



    })

  })

})