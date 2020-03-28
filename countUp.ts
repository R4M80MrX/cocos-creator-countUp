// Rambo 2019/12/18

const {
  ccclass,
  disallowMultiple,
  property,
  menu,
  requireComponent,
} = cc._decorator;

export interface CountUpOptions {
  // (default)
  startVal: number; // number to start at (0)
  decimalPlaces: number; // number of decimal places (0)
  duration?: number; // animation duration in seconds (2)
  useGrouping?: boolean; // example: 1,000 vs 1000 (true)
  useEasing: boolean; // ease animation (true)
  smartEasingThreshold?: number; // smooth easing for large numbers above this if useEasing (999)
  smartEasingAmount?: number; // amount to be eased for numbers above threshold (333)
  separator?: string; // grouping separator (,)
  decimal?: string; // decimal (.)
  // easingFn: easing function for animation (easeOutExpo)
  easingFn?: (t: number, b: number, c: number, d: number) => number;
  formattingFn?: (n: number) => string; // this function formats result
  prefix?: string; // text prepended to result
  suffix?: string; // text appended to result
  numerals?: string[]; // numeral glyph substitution
}

@ccclass
@disallowMultiple()
@menu('Rambo/CountUp')
@requireComponent(cc.Label)
export default class CountUp extends cc.Component {
  @property({
    type: cc.Float,
    tooltip: 'label最初显示的值(默认0)',
  })
  startVal: number = 0;

  @property({
    type: cc.Float,
    tooltip: 'label最终显示的值(默认0)',
  })
  endVal: number = 0;

  @property({
    type: cc.Integer,
    tooltip: '显示的小数位数(默认0)',
  })
  decimalPlaces: number = 0;

  @property({
    type: cc.Float,
    tooltip: '动画持续时间',
  })
  duration: number = 2;

  @property({
    tooltip: '是否三位一组, 如`1,000`而不是`1000`',
  })
  useGrouping: boolean = true;

  @property({
    tooltip: '是否开启easing缓动',
  })
  useEasing: boolean = true;

  @property({
    type: cc.Float,
    tooltip: 'easing节流, 数字越大easing效果越平滑',
  })
  smartEasingThreshold: number = 999;

  @property({
    type: cc.Float,
    tooltip: 'easing 数量',
  })
  smartEasingAmount: number = 333;

  @property({
    tooltip: '分组符, 默认`,`',
  })
  separator: string = ',';

  @property({
    tooltip: '小数点, 默认`.`',
  })
  decimal: string = '.';

  @property({
    tooltip: '前缀, `$ xxx`',
  })
  prefix: string = '';

  @property({
    tooltip: '后缀, `xxx元`',
  })
  suffix: string = '';

  @property({
    type: [cc.String],
    tooltip: '数字字形替换',
  })
  numerals: Array<string> = [];

  private options?: CountUpOptions;

  private el?: cc.Label | cc.EditBox;
  private rAF: any;
  private startTime: number;
  private decimalMult: number;
  private remaining: number;
  private finalEndVal: number; // for smart easing
  private countDown = false;
  formattingFn: (num: number) => string;
  easingFn?: (t: number, b: number, c: number, d: number) => number;
  callback: (args?: any) => any;
  error = '';
  paused = true;
  frameVal: number;
  private _hasSetUp = false;

  setup(
    endVal?: number,
    target?: string | cc.Node | undefined,
    options?: CountUpOptions
  ) {
    this.options = {
      ...{
        startVal: this.startVal,
        endVal: this.endVal,
        decimalPlaces: this.decimalPlaces,
        duration: this.duration,
        useGrouping: this.useGrouping,
        useEasing: this.useEasing,
        smartEasingThreshold: this.smartEasingThreshold,
        smartEasingAmount: this.smartEasingAmount,
        separator: this.separator,
        decimal: this.decimal,
        prefix: this.prefix,
        suffix: this.suffix,
        numerals: this.numerals,
      },
      ...options,
    };

    this.formattingFn = this.options.formattingFn
      ? this.options.formattingFn
      : this.formatNumber;
    this.easingFn = this.options.easingFn
      ? this.options.easingFn
      : this.easeOutExpo;

    let targetNode: cc.Node;
    if (target) {
      targetNode =
        typeof target === 'string' ? cc.find(target, this.node) : target;
    } else {
      targetNode = this.node;
    }

    this.el =
      targetNode.getComponent(cc.Label) || targetNode.getComponent(cc.EditBox);

    this.startVal = this.el.string
      ? this.validateValue(this.el.string)
      : this.validateValue(this.options.startVal);
    this.frameVal = this.startVal;
    this.endVal = this.validateValue(endVal || this.endVal);
    this.options.decimalPlaces = Math.max(0 || this.options.decimalPlaces);
    this.decimalMult = 10 ** this.options.decimalPlaces;
    this.resetDuration();
    this.options.separator = String(this.options.separator);
    this.useEasing = this.options.useEasing;
    if (this.options.separator === '') {
      this.options.useGrouping = false;
    }
    if (this.el) {
      this.printValue(this.startVal);
    } else {
      this.error = '[CountUp] target is null or undefined';
    }

    this._hasSetUp = true;

    return this;
  }

  // determines where easing starts and whether to count down or up
  private determineDirectionAndSmartEasing() {
    const end = this.finalEndVal ? this.finalEndVal : this.endVal;
    this.countDown = this.startVal > end;
    const animateAmount = end - this.startVal;
    if (Math.abs(animateAmount) > this.options.smartEasingThreshold) {
      this.finalEndVal = end;
      const up = this.countDown ? 1 : -1;
      this.endVal = end + up * this.options.smartEasingAmount;
      this.duration /= 2;
    } else {
      this.endVal = end;
      this.finalEndVal = null;
    }
    if (this.finalEndVal) {
      this.useEasing = false;
    } else {
      this.useEasing = this.options.useEasing;
    }
  }

  // start animation
  startAnim(callback?: (args?: any) => any): CountUp {
    if (!this._hasSetUp) {
      this.setup();
    }
    if (this.error) {
      console.log(this.error);
      return this;
    }
    this.callback = callback;
    if (this.duration > 0) {
      this.determineDirectionAndSmartEasing();
      this.paused = false;
      this.rAF = window.requestAnimationFrame(this.count);
    } else {
      this.printValue(this.endVal);
    }

    return this;
  }

  // pause/resume animation
  pauseResume() {
    if (!this.paused) {
      cancelAnimationFrame(this.rAF);
    } else {
      this.startTime = null;
      this.duration = this.remaining;
      this.startVal = this.frameVal;
      this.determineDirectionAndSmartEasing();
      this.rAF = requestAnimationFrame(this.count);
    }
    this.paused = !this.paused;

    return this;
  }

  // reset to startVal so animation can be run again
  reset() {
    cancelAnimationFrame(this.rAF);
    this.paused = true;
    this.resetDuration();
    this.startVal = this.validateValue(this.options.startVal);
    this.frameVal = this.startVal;
    this.printValue(this.startVal);

    return this;
  }

  // pass a new endVal and start animation
  cUpdate(newEndVal: string | number) {
    cancelAnimationFrame(this.rAF);
    this.startTime = null;
    this.endVal = this.validateValue(newEndVal);
    if (this.endVal === this.frameVal) {
      return this;
    }
    this.startVal = this.frameVal;
    if (!this.finalEndVal) {
      this.resetDuration();
    }
    this.determineDirectionAndSmartEasing();
    this.rAF = requestAnimationFrame(this.count);

    return this;
  }

  count = (timestamp: number) => {
    if (!this.startTime) {
      this.startTime = timestamp;
    }

    const progress = timestamp - this.startTime;
    this.remaining = this.duration - progress;

    // to ease or not to ease
    if (this.useEasing) {
      if (this.countDown) {
        this.frameVal =
          this.startVal -
          this.easingFn(
            progress,
            0,
            this.startVal - this.endVal,
            this.duration
          );
      } else {
        this.frameVal = this.easingFn(
          progress,
          this.startVal,
          this.endVal - this.startVal,
          this.duration
        );
      }
    } else if (this.countDown) {
      this.frameVal =
        this.startVal -
        (this.startVal - this.endVal) * (progress / this.duration);
    } else {
      this.frameVal =
        this.startVal +
        (this.endVal - this.startVal) * (progress / this.duration);
    }

    // don't go past endVal since progress can exceed duration in the last frame
    if (this.countDown) {
      this.frameVal = this.frameVal < this.endVal ? this.endVal : this.frameVal;
    } else {
      this.frameVal = this.frameVal > this.endVal ? this.endVal : this.frameVal;
    }

    // decimal
    this.frameVal =
      Math.round(this.frameVal * this.decimalMult) / this.decimalMult;

    // format and print value
    this.printValue(this.frameVal);

    // whether to continue
    if (progress < this.duration) {
      this.rAF = requestAnimationFrame(this.count);
    } else if (this.finalEndVal !== null) {
      // smart easing
      this.cUpdate(this.finalEndVal);
    } else if (this.callback) {
      this.callback();
    }

    return this;
  };

  printValue(val: number) {
    const result = this.formattingFn(val);

    if (this.el instanceof cc.Label) {
      this.el.string = result;
    } else if (this.el instanceof cc.EditBox) {
      const input = this.el as cc.EditBox;
      input.string = result;
    }
  }

  ensureNumber(n: any) {
    return typeof n === 'number' && !isNaN(n);
  }

  validateValue(value: string | number): number {
    const newValue = Number(value);
    if (!this.ensureNumber(newValue)) {
      this.error = `[CountUp] invalid start or end value: ${value}`;
      return null;
    }
    return newValue;
  }

  private resetDuration() {
    this.startTime = null;
    this.duration = Number(this.options.duration) * 1000;
    this.remaining = this.duration;
  }

  // default format and easing functions

  formatNumber = (num: number): string => {
    const neg = num < 0 ? '-' : '';
    let result: string;
    let x1: string;
    let x2: string;
    let x3: string;
    result = Math.abs(num).toFixed(this.options.decimalPlaces);
    result += '';
    const x = result.split('.');
    x1 = x[0];
    x2 = x.length > 1 ? this.options.decimal + x[1] : '';
    if (this.options.useGrouping) {
      x3 = '';
      for (let i = 0, len = x1.length; i < len; ++i) {
        if (i !== 0 && i % 3 === 0) {
          x3 = this.options.separator + x3;
        }
        x3 = x1[len - i - 1] + x3;
      }
      x1 = x3;
    }
    // optional numeral substitution
    if (this.options.numerals && this.options.numerals.length) {
      x1 = x1.replace(/[0-9]/g, w => this.options.numerals[+w]);
      x2 = x2.replace(/[0-9]/g, w => this.options.numerals[+w]);
    }
    return neg + this.options.prefix + x1 + x2 + this.options.suffix;
  };

  easeOutExpo = (t: number, b: number, c: number, d: number): number =>
    (c * (-(2 ** ((-10 * t) / d)) + 1) * 1024) / 1023 + b;
}
