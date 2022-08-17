/*
 * @Author: xiaotian.zy
 * @Descriptions: WebpackService，主要用于注册两个子命令的运行逻辑
 * @TodoList: 无
 * @Date: 2022-08-17 16:30:52
 * @Last Modified by: xiaotian.zy
 * @Last Modified time: 2022-08-17 16:31:16
 */

import Context, { IContextOptions } from '../core/Context';
import start = require('./start');
import build = require('./build');

class WebpackService extends Context {
  constructor(props: IContextOptions) {
    super(props);

    // 注册两个子命令的运行逻辑
    super.registerCommandModules('start', start);
    super.registerCommandModules('build', build);
  }
}

export default WebpackService;
