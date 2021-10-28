
const Active = require('./active')
const log = require('logsync')

/**
 * 
 * @since  1.0
 * @author Lo Shih <kloshih@gmail.com>
 * @copyright Copyright 2021 Lo Shih 
 */
class Api extends Active {

  // static provider(config, owner) {
  //   // let url = config.url;
  // }

  static provides(config, owner, base) {
    const url = config.url;
    switch (url && url.scheme) {
      case 'tcpd':
      case 'ssld':
      case 'tlsd':
        return { priority:10 }
      default:
        return null;
    }
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

}
module.exports = Api;