const { format, parseISO } = require('date-fns');

class DateUtils {
  constructor() {
    this.cache = new Map();
  }

  formatISO(dateString, fmt = 'MMM d, yyyy') {
    const key = `${dateString}|${fmt}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, format(parseISO(dateString), fmt));
    }
    return this.cache.get(key);
  }

  now(fmt = 'MMM d, HH:mm') {
    const key = `now|${fmt}|${new Date().toDateString()}`;
    if (!this.cache.has(key)) this.cache.set(key, format(new Date(), fmt));
    return this.cache.get(key);
  }
}

module.exports = DateUtils;
