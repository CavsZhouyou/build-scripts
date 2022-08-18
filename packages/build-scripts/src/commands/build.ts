/*
 * @Author: xiaotian.zy
 * @Descriptions: build 命令执行逻辑
 * @TodoList: 无
 * @Date: 2022-08-17 16:29:00
 * @Last Modified by: xiaotian.zy
 * @Last Modified time: 2022-08-17 16:30:06
 */

import WebpackService from '../service/WebpackService';
import { IContextOptions, ITaskConfig } from '../core/Context';
import { IRunOptions } from '../types';

type BuildResult = void | ITaskConfig[];

export = async function({
  args,
  rootDir,
  eject,
  plugins,
  getBuiltInPlugins,
}: Omit<IContextOptions, 'command'> & IRunOptions): Promise<BuildResult> {
  // 标明执行环境
  const command = 'build';

  // WebpackService 初始化
  const service = new WebpackService({
    args,
    command,
    rootDir,
    plugins,
    getBuiltInPlugins,
  });

  // WebpackService 执行，eject 是否返回 webpack 配置
  return (await service.run({ eject })) as BuildResult;
};
