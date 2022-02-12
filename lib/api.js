
const Active = require('./active')
// const log = require('logsync')

/**
 * 
 * @since  1.0
 * @author Lo Shih <kloshih@gmail.com>
 * @copyright Copyright 2021 Lo Shih 
 */
class Api extends Active {

  static provides(config, owner, base) {
    const url = config.url;
    return null;
  }

  static get props() {
    return {
      url: { type:'url', implicit:true },
    }
  }

  constructor(config, owner) {
    super(config, owner);
    this.next = null;
    this.prevs = [];
  }

  get tail() {
    return this.next ? this.next.tail() : this;
  }

  get multisession() {
    return this.next ? this.next.multisession : false;
  }

}
module.exports = Api;

