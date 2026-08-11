export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  readonly #instant: number;

  constructor(instant: Date) {
    this.#instant = instant.getTime();
  }

  now(): Date {
    return new Date(this.#instant);
  }
}
