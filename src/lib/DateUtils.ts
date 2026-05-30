import { format, parseISO } from 'date-fns';

export default class DateUtils {
  private cache: Map<string, string>;

  constructor() {
    this.cache = new Map();
  }

  formatISO(dateString: string, fmt: string = 'MMM d, yyyy'): string {
    const key = `${dateString}|${fmt}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, format(parseISO(dateString), fmt));
    }
    return this.cache.get(key) as string;
  }

  now(fmt: string = 'MMM d, HH:mm'): string {
    const key = `now|${fmt}|${new Date().toDateString()}`;
    if (!this.cache.has(key)) this.cache.set(key, format(new Date(), fmt));
    return this.cache.get(key) as string;
  }
}
