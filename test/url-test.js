
const { expect, assert } = require('chai');

const Url = require('../lib/url')
const { parseQuery, formatQuery } = Url;

describe("Url", () => {

  describe("Basic functionality", () => {
    
    const cases = [
      { str:'a=1&b=2',          qry:{a:1,b:2},         },
      { str:'a.b=1&b=2',        qry:{a:{b:1},b:2},     },
      { str:'a.b[]=3&b=2',      qry:{a:{b:[3]},b:2},   },
      { str:'a[]=3&a[]=4',      qry:{a:[3,4]},         },
      { str:'a[].b=3&a[].b=4',  qry:{a:[{b:3},{b:4}]}, },
      { str:'a.b=3&a.c=4',      qry:{a:{b:3,c:4}},     },
      { str:'a.b.c.d=5',        qry:{a:{b:{c:{d:5}}}}, },
    ]

    cases.forEach(({ str, qry }) => {
      it(`can parse ${JSON.stringify(str)} and format ${JSON.stringify(qry)}`, () => {
        let qry1 = parseQuery(str);
        assert.deepEqual(qry1, qry);
        let str1 = formatQuery(qry1);
        assert.equal(str1, str);
      })
    })

  })

})