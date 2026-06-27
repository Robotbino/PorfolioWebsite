export interface MorphFrame {
  rendered: number;
  transit: number;
  fromIndex: number;
  toIndex: number;
  frac: number;
  eased: number;
}

const easeInOutQuart = (t: number): number =>
  t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

export class MorphDriver {
  private rendered = 0;
  private smoothedVel = 0;

  advance(target: number, count: number, reduceMotion: boolean): MorphFrame {
    let transit = 0;

    if (reduceMotion) {
      this.rendered = ((target % count) + count) % count;
    } else {
      let delta = target - this.rendered;
      delta -= count * Math.round(delta / count);
      const step = delta * 0.12;
      this.rendered = (((this.rendered + step) % count) + count) % count;

      this.smoothedVel += (Math.abs(step) - this.smoothedVel) * 0.2;
      transit = Math.min(0.75, this.smoothedVel * 6);
    }

    const base = this.rendered;
    let fromIndex: number;
    let toIndex: number;
    let frac: number;

    if (reduceMotion) {
      fromIndex = toIndex = Math.round(base) % count;
      frac = 0;
    } else {
      fromIndex = Math.floor(base);
      toIndex = (fromIndex + 1) % count;
      frac = base - fromIndex;
    }

    const eased = frac < 1e-4 ? 0 : easeInOutQuart(frac);

    return { rendered: this.rendered, transit, fromIndex, toIndex, frac, eased };
  }
}
