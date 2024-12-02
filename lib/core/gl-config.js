export class GlConfig {

  constructor() {
    this.name = 'TgGlConfig';
    this.storage = {
      'autosave': true,

      'title': '',
      'renderer': 'WebGLRenderer',
      'renderer/antialias': true,
      'renderer/gammaInput': false,
      'renderer/gammaOutput': false,
      'renderer/shadows': true,

      'settings/history': false,
    };

    // common settings
    this.settings = {
      invertMouse: false,
      showBox3: false,
    };

    this.initConfig();
  }

  // initiliaze
  initConfig() {
    if (window.localStorage[this.name] === undefined) {
      window.localStorage[this.name] = JSON.stringify(this.storage);
    } else {
      const data = JSON.parse(window.localStorage[this.name]);

      // eslint-disable-next-line guard-for-in
      for (const key in data) {
        this.storage[key] = data[key];
      }
    }
  }

  getKey(key) {
    return this.storage[key];
  }

  setKey() {
    // key, value, key, value ...
    for (let i = 0, l = arguments.length; i < l; i += 2) {
      this.storage[arguments[i]] = arguments[i + 1];
    }

    window.localStorage[this.name] = JSON.stringify(this.storage);
    console.log('[' + /\d\d\:\d\d\:\d\d/.exec(new Date())[0] + ']', 'Saved config to LocalStorage.');
  }

  // clear
  clear() {
    delete window.localStorage[this.name];
  }
}