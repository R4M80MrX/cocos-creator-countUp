# cocos-creator-countUp

cocos creator 版的 countUp.js, 数字 label 缓动效果组件
参数说明详见 [countUp.js](https://github.com/inorganik/countUp.js)

![inspector](https://raw.githubusercontent.com/R4M80MrX/cocos-creator-countUp/master/images/inspector.png)

```typescript
import CountUp from "../Libs/countUp/countUp";

const { ccclass, property } = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {
  @property(CountUp)
  labelCountUp: CountUp = null;

  pool: cc.NodePool;

  start() {
    this.labelCountUp.startAnim();

    const n = new cc.Node();
    const l = n.addComponent(cc.Label);
    l.string = "1";
    this.node.addChild(n);
    n.addComponent(CountUp)
      .setup(3000)
      .startAnim();

    window.setTimeout(() => {
      this.labelCountUp.cUpdate(1000);
    }, 4000);
  }
}
```
