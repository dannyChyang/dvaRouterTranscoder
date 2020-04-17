# dvaRouterTranscoder
项目中使用的`dva`升级到beta版本后，编译时出现警告
``` js
Warning: Please use `require("dva").router` instead of `require("dva/router")`. 
Support for the latter will be removed in the next major release.
```
[相关issue](https://github.com/dvajs/dva/issues/2143#issuecomment-506613405)

出现这个警告的原因是：dva@2.6 beta 全部走 esm，然后项目中开 tree-shaking 把没用到的功能摇掉，推荐用 require('dva')，而不是 require('dva/router')，所以给了警告。

提示说明需要更改`dva router`的引用方式，来消除该警告。

即需要将项目代码中的
`
import { A, B } from 'dva/router'
`
替换为
`
import { router } from 'dva';
const { A, B } = router;
`的形式

#### 使用
该脚本将根据传入的`srcPath`路径，扫描其下`js|jsx`代码中对`dva/XXX`的引用，按照源文件目录结构，将替换后的文件输出到`distPath`目录下。
```
babel-node read --dir %srcPath% --output %distPath%
```
示例：`npm run example`

#### 要点
- 解析语法由 `babel.parse` 函数的 `options.plugins` 配置提供支持。详见[@babel/parser文档](https://babeljs.io/docs/en/babel-parser
- 找出所有`import-from dva/XXX'的`import`语句
- const 语句声明插入文件的import声明部分之后。
- 文件中可能已经存在`import { elseExport } from 'dva'`语句，因此需要将`elseExport`与`router`合并为`import { elseExport, router } from 'dva'`。

#### 未实现
- 脚本只针对项目中的实际场景做了处理，因此未考虑实下以下情况
  - `import 'dva'`
  - `import dvaDefault,{ elseExport} from 'dva'`
  - `import * as dvaJS from 'dva'`
- 输出代码格式部分未处理，建议自行lint