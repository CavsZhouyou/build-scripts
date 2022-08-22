/*
 * @Author: xiaotian.zy 
 * @Descriptions: 插件封装机制核心
 * @TodoList: 无
 * @Date: 2022-08-17 16:31:47 
 * @Last Modified by: xiaotian.zy
 * @Last Modified time: 2022-08-22 19:20:44
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import webpack, { MultiStats } from 'webpack';
import { Logger } from 'npmlog';
import { AggregatedResult } from '@jest/test-result';
import { GlobalConfig } from '@jest/types/build/Config';
import * as fg from 'fast-glob';
import type WebpackDevServer from 'webpack-dev-server';
import {
  IHash,
  Json,
  JsonValue,
  MaybeArray,
  MaybePromise,
  JsonArray,
} from '../types';
import hijackWebpackResolve from '../utils/hijackWebpack';
import loadConfig from '../utils/loadConfig';

import assert = require('assert');
import _ = require('lodash');
import camelCase = require('camelcase');
import WebpackChain = require('webpack-chain');
import deepmerge = require('deepmerge');
import log = require('../utils/log');

const PKG_FILE = 'package.json';
const USER_CONFIG_FILE = ['build.json', 'build.config.(js|ts)'];
const PLUGIN_CONTEXT_KEY = [
  'command' as 'command',
  'commandArgs' as 'commandArgs',
  'rootDir' as 'rootDir',
  'userConfig' as 'userConfig',
  'originalUserConfig' as 'originalUserConfig',
  'pkg' as 'pkg',
  'webpack' as 'webpack',
];

const VALIDATION_MAP = {
  string: 'isString' as 'isString',
  number: 'isNumber' as 'isNumber',
  array: 'isArray' as 'isArray',
  object: 'isObject' as 'isObject',
  boolean: 'isBoolean' as 'isBoolean',
};

const BUILTIN_CLI_OPTIONS = [
  { name: 'port', commands: ['start'] },
  { name: 'host', commands: ['start'] },
  { name: 'disableAsk', commands: ['start'] },
  { name: 'config', commands: ['start', 'build', 'test'] },
];

export type IWebpack = typeof webpack;

export type PluginContext = Pick<Context, typeof PLUGIN_CONTEXT_KEY[number]>;

export type UserConfigContext = PluginContext & {
  taskName: string;
};

export type ValidationKey = keyof typeof VALIDATION_MAP;

export interface IJestResult {
  results: AggregatedResult;
  globalConfig: GlobalConfig;
}

export interface IOnHookCallbackArg {
  err?: Error;
  args?: CommandArgs;
  stats?: MultiStats;
  url?: string;
  devServer?: WebpackDevServer;
  config?: any;
  result?: IJestResult;
}

export interface IOnHookCallback {
  (arg?: IOnHookCallbackArg): MaybePromise<void>;
}

export interface IOnHook {
  (eventName: string, callback: IOnHookCallback): void;
}

export interface IPluginConfigWebpack {
  (config: WebpackChain): Promise<void> | void;
}

export interface IUserConfigWebpack {
  (config: WebpackChain, value: JsonValue, context: UserConfigContext): Promise<void> | void;
}

export interface IValidation {
  (value: any): boolean;
}

export interface IUserConfigArgs {
  name: string;
  configWebpack?: IUserConfigWebpack;
  defaultValue?: any;
  validation?: ValidationKey | IValidation;
  ignoreTasks?: string[];
}

export interface ICliOptionArgs {
  name: string;
  configWebpack?: IUserConfigWebpack;
  commands?: string[];
  ignoreTasks?: string[];
}

export interface IOnGetWebpackConfig {
  (name: string, fn: IPluginConfigWebpack): void;
  (fn: IPluginConfigWebpack): void;
}

export interface IOnGetJestConfig {
  (fn: IJestConfigFunction): void;
}

export interface IRegisterTask {
  (name: string, chainConfig: WebpackChain): void;
}

export interface ICancelTask {
  (name: string): void;
}

export interface IMethodRegistration {
  (args?: any): void;
}

export interface IMethodCurry {
  (data?: any): IMethodRegistration;
}

export type IMethodFunction = IMethodRegistration | IMethodCurry;

export interface IMethodOptions {
  pluginName?: boolean;
}

export interface IRegisterMethod {
  (name: string, fn: IMethodFunction, options?: IMethodOptions): void;
}

type IMethod = [string, string] | string;

export interface IApplyMethod {
  (config: IMethod, ...args: any[]): any;
}

export interface IApplyMethodAPI {
  (name: string, ...args: any[]): any;
}

export interface IHasMethod {
  (name: string): boolean;
}

export interface IModifyConfig {
  (userConfig: IUserConfig): Omit<IUserConfig, 'plugins'>;
}

export interface IModifyUserConfig {
  (configKey: string | IModifyConfig, value?: any, options?: { deepmerge: boolean }): void;
}

export interface IGetAllPlugin {
  (dataKeys?: string[]): Partial<IPluginInfo>[];
}

export interface IPluginAPI {
  log: Logger;
  context: PluginContext;
  registerTask: IRegisterTask;
  getAllTask: () => string[];
  getAllPlugin: IGetAllPlugin;
  onGetWebpackConfig: IOnGetWebpackConfig;
  onGetJestConfig: IOnGetJestConfig;
  onHook: IOnHook;
  setValue: <T>(name: string, value: T) => void;
  getValue: <T>(name: string) => T;
  registerUserConfig: (args: MaybeArray<IUserConfigArgs>) => void;
  hasRegistration: (name: string, type?: 'cliOption' | 'userConfig') => boolean;
  registerCliOption: (args: MaybeArray<ICliOptionArgs>) => void;
  registerMethod: IRegisterMethod;
  applyMethod: IApplyMethodAPI;
  modifyUserConfig: IModifyUserConfig;
}

export interface IPluginInfo {
  fn: IPlugin;
  name?: string;
  pluginPath?: string;
  options: IPluginOptions;
}

export type IPluginOptions = Json | JsonArray;

export interface IPlugin {
  (api: IPluginAPI, options?: IPluginOptions): MaybePromise<void>;
}

export type CommandName = 'start' | 'build' | 'test';

export type CommandArgs = IHash<any>;

export type IPluginList = (string | [string, Json])[];

export type IGetBuiltInPlugins = (userConfig: IUserConfig) => IPluginList;

export type CommandModule<T> = (context: Context, options: any) => Promise<T>;

export interface ICommandModules<T = any> {
  [command: string]: CommandModule<T>;
}

export type RegisterCommandModules = (key: string, module: CommandModule<any>) => void;

export interface IContextOptions {
  command: CommandName;
  rootDir: string;
  args: CommandArgs;
  plugins?: IPluginList;
  getBuiltInPlugins?: IGetBuiltInPlugins;
  commandModules?: ICommandModules;
}

export interface ITaskConfig {
  name: string;
  chainConfig: WebpackChain;
  modifyFunctions: IPluginConfigWebpack[];
}

export interface IUserConfig extends Json {
  plugins: IPluginList;
}

export interface IModeConfig {
  [name: string]: IUserConfig;
}

export interface IJestConfigFunction {
  (JestConfig: Json): Json;
}

export interface IModifyRegisteredConfigCallbacks<T> {
  (configArgs: T): T;
}

export interface IUserConfigRegistration {
  [key: string]: IUserConfigArgs;
}

export interface ICliOptionRegistration {
  [key: string]: ICliOptionArgs;
}

export interface IModifyConfigRegistration {
  (configFunc: IModifyRegisteredConfigCallbacks<IUserConfigRegistration>): void;
  (
    configName: string,
    configFunc: IModifyRegisteredConfigCallbacks<IUserConfigArgs>,
  ): void;
}

export interface IModifyCliRegistration {
  (configFunc: IModifyRegisteredConfigCallbacks<ICliOptionRegistration>): void;
  (
    configName: string,
    configFunc: IModifyRegisteredConfigCallbacks<ICliOptionArgs>,
  ): void;
}

export type IModifyRegisteredConfigArgs =
  | [string, IModifyRegisteredConfigCallbacks<IUserConfigArgs>]
  | [IModifyRegisteredConfigCallbacks<IUserConfigRegistration>];
export type IModifyRegisteredCliArgs =
  | [string, IModifyRegisteredConfigCallbacks<ICliOptionArgs>]
  | [IModifyRegisteredConfigCallbacks<ICliOptionRegistration>];

export type IOnGetWebpackConfigArgs =
  | [string, IPluginConfigWebpack]
  | [IPluginConfigWebpack];

export type IRegistrationKey =
  | 'modifyConfigRegistrationCallbacks'
  | 'modifyCliRegistrationCallbacks';

const mergeConfig = <T>(currentValue: T, newValue: T): T => {
  // only merge when currentValue and newValue is object and array
  const isBothArray = Array.isArray(currentValue) && Array.isArray(newValue);
  const isBothObject = _.isPlainObject(currentValue) && _.isPlainObject(newValue);
  if (isBothArray || isBothObject) {
    return deepmerge(currentValue, newValue);
  } else {
    return newValue;
  }
};

class Context {
  // 当前执行命令
  public command: CommandName;

  // 命令参数
  public commandArgs: CommandArgs;

  // 项目执行目录
  public rootDir: string;

  // webpack 实例
  public webpack: IWebpack;

  // 当前项目 package.json 值
  public pkg: Json;

  // 用户配置
  public userConfig: IUserConfig;

  // 原始用户配置，build.json 或 build.config.js 文件值
  public originalUserConfig: IUserConfig;

  // 项目执行插件
  public plugins: IPluginInfo[];

  // 外部传入的执行配置
  private options: IContextOptions;

  // 通过 registerTask 注册，存放初始的 webpack-chain 配置
  private configArr: ITaskConfig[];

  // webpack 配置修改函数注册
  private modifyConfigFns: IOnGetWebpackConfigArgs[];

  // jest 配置修改函数注册
  private modifyJestConfig: IJestConfigFunction[];

  // 用户配置修改回调
  private modifyConfigRegistrationCallbacks: IModifyRegisteredConfigArgs[];

  // cli options 修改回调
  private modifyCliRegistrationCallbacks: IModifyRegisteredConfigArgs[];

  // hook 回调
  private eventHooks: {
    [name: string]: IOnHookCallback[];
  };

  // 内部值，用于插件间变量共享
  private internalValue: IHash<any>;

  // userConfig 注册配置项
  private userConfigRegistration: IUserConfigRegistration;

  // cliOption 注册配置项
  private cliOptionRegistration: ICliOptionRegistration;

  // 自定义方法注册
  private methodRegistration: { [name: string]: [IMethodFunction, any] };

  // 已取消的 webpack 任务
  private cancelTaskNames: string[];

  // 注册的命令功能模块
  public commandModules: ICommandModules = {};

  // 默认值初始化
  constructor(options: IContextOptions) {
    const {
      command,
      rootDir = process.cwd(),
      args = {},
    } = options || {};

    this.options = options;
    this.command = command;
    this.commandArgs = args;
    this.rootDir = rootDir;
    /**
     * config array
     * {
     *   name,
     *   chainConfig,
     *   webpackFunctions,
     * }
     */
    this.configArr = [];
    this.modifyConfigFns = [];
    this.modifyJestConfig = [];
    this.modifyConfigRegistrationCallbacks = [];
    this.modifyCliRegistrationCallbacks = [];
    this.eventHooks = {}; // lifecycle functions
    this.internalValue = {}; // internal value shared between plugins
    this.userConfigRegistration = {};
    this.cliOptionRegistration = {};
    this.methodRegistration = {};
    this.cancelTaskNames = [];

    // 获取项目的 package.json 文件
    this.pkg = this.getProjectFile(PKG_FILE);
    // register builtin options
    // 注册 cli options
    this.registerCliOption(BUILTIN_CLI_OPTIONS);
  }

  // 配置注册，包括 cliOption 和 userConfig 两种
  private registerConfig = (
    type: string,
    args: MaybeArray<IUserConfigArgs> | MaybeArray<ICliOptionArgs>,
    parseName?: (name: string) => string,
  ): void => {
    const registerKey = `${type}Registration` as
      | 'userConfigRegistration'
      | 'cliOptionRegistration';

    if (!this[registerKey]) {
      throw new Error(
        `unknown register type: ${type}, use available types (userConfig or cliOption) instead`,
      );
    }

    const configArr = _.isArray(args) ? args : [args];
    configArr.forEach((conf): void => {
      // 执行名称格式化函数
      const confName = parseName ? parseName(conf.name) : conf.name;
      if (this[registerKey][confName]) {
        throw new Error(`${conf.name} already registered in ${type}`);
      }

      // 写入对应注册值
      this[registerKey][confName] = conf;

      // 如果 userConfig 配置项有默认值，则先赋默认值
      // set default userConfig
      if (
        type === 'userConfig' &&
        _.isUndefined(this.userConfig[confName]) &&
        Object.prototype.hasOwnProperty.call(conf, 'defaultValue')
      ) {
        this.userConfig[confName] = (conf as IUserConfigArgs).defaultValue;
      }
    });
  };

  // webpack 配置更改
  private async runConfigWebpack(
    fn: IUserConfigWebpack,
    configValue: JsonValue,
    ignoreTasks: string[] | null,
  ): Promise<void> {

    // 遍历已注册的 webapck 任务
    for (const webpackConfigInfo of this.configArr) {

      // webpack 任务名称
      const taskName = webpackConfigInfo.name;

      // 忽略任务判断
      let ignoreConfig = false;
      if (Array.isArray(ignoreTasks)) {
        ignoreConfig = ignoreTasks.some(ignoreTask =>
          new RegExp(ignoreTask).exec(taskName),
        );
      }
      
      // 执行对应的 webpack 配置更新函数
      if (!ignoreConfig) {
        const userConfigContext: UserConfigContext = {
          ..._.pick(this, PLUGIN_CONTEXT_KEY),
          taskName,
        };
        // eslint-disable-next-line no-await-in-loop
        await fn(webpackConfigInfo.chainConfig, configValue, userConfigContext);
      }
    }
  }

  // 文件内容获取，工具函数
  private getProjectFile = (fileName: string): Json => {
    const configPath = path.resolve(this.rootDir, fileName);

    let config = {};
    if (fs.existsSync(configPath)) {
      try {
        config = fs.readJsonSync(configPath);
      } catch (err) {
        log.info(
          'CONFIG',
          `Fail to load config file ${configPath}, use empty object`,
        );
      }
    }

    return config;
  };

  // 获取用户配置，一般为 build.json 和 build.config.js 的文件值
  private getUserConfig = async (): Promise<IUserConfig> => {
    const { config } = this.commandArgs;
    let configPath = '';
    if (config) {
      configPath = path.isAbsolute(config)
        ? config
        : path.resolve(this.rootDir, config);
    } else {
      // golb 文件查询，使用第一个匹配文件
      const [defaultUserConfig] = await fg(USER_CONFIG_FILE, { cwd: this.rootDir, absolute: true });
      configPath = defaultUserConfig;
    }
    let userConfig: IUserConfig = {
      plugins: [],
    };
    if (configPath && fs.existsSync(configPath)) {
      try {
        userConfig = await loadConfig(configPath, log);
      } catch (err) {
        log.info(
          'CONFIG',
          `Fail to load config file ${configPath}`,
        );
        log.error('CONFIG', err.stack || err.toString());
        process.exit(1);
      }
    } else {
      log.error(
        'CONFIG',
        `config file${`(${configPath})` || ''} is not exist`,
      );
      process.exit(1);
    }

    // mode 配置合并
    return this.mergeModeConfig(userConfig);
  };

  // 合并 mode 配置（mode 可以理解为不同执行模式）
  private mergeModeConfig = (userConfig: IUserConfig): IUserConfig => {
    const { mode } = this.commandArgs;
    // modify userConfig by userConfig.modeConfig
    if (
      userConfig.modeConfig &&
      mode &&
      (userConfig.modeConfig as IModeConfig)[mode]
    ) {

      // 获取对应 mode 的插件和基本配置
      const {
        plugins,
        ...basicConfig
      } = (userConfig.modeConfig as IModeConfig)[mode] as IUserConfig;

      // 顶层插件配置
      const userPlugins = [...userConfig.plugins];

      if (Array.isArray(plugins)) {
        const pluginKeys = userPlugins.map(pluginInfo => {
          return Array.isArray(pluginInfo) ? pluginInfo[0] : pluginInfo;
        });
        plugins.forEach(pluginInfo => {
          const [pluginName] = Array.isArray(pluginInfo)
            ? pluginInfo
            : [pluginInfo];
          const pluginIndex = pluginKeys.indexOf(pluginName);
          if (pluginIndex > -1) {
            // 如果顶层插件配置存在该插件，则用 mode 的插件配置覆盖顶层配置
            // overwrite plugin info by modeConfig
            userPlugins[pluginIndex] = pluginInfo;
          } else {
            // 如果顶层插件配置不存在该插件，则直接加在最后
            // push new plugin added by modeConfig
            userPlugins.push(pluginInfo);
          }
        });
      }
      return { ...userConfig, ...basicConfig, plugins: userPlugins };
    }
    return userConfig;
  };

  // plugins 路径和内容解析
  private resolvePlugins = (builtInPlugins: IPluginList): IPluginInfo[] => {
    const userPlugins = [
      // 外部传入插件
      ...builtInPlugins,
      // build.json 中的插件
      ...(this.userConfig.plugins || []),
    ].map(
      (pluginInfo): IPluginInfo => {
        let fn;

        // 如果直接是内联函数的形式
        if (_.isFunction(pluginInfo)) {
          return {
            fn: pluginInfo,
            options: {},
          };
        }

        // 如果是数组形式，[插件名,插件配置]
        const plugins: [string, IPluginOptions] = Array.isArray(pluginInfo)
          ? pluginInfo
          : [pluginInfo, undefined];


        // 插件路径解析，有的是本地的自定义插件
        const pluginResolveDir = process.env.EXTRA_PLUGIN_DIR
          ? [process.env.EXTRA_PLUGIN_DIR, this.rootDir]
          : [this.rootDir];
        const pluginPath = path.isAbsolute(plugins[0])
          ? plugins[0]
          : require.resolve(plugins[0], { paths: pluginResolveDir });
        const options = plugins[1];

        try {
          // 获取插件内容
          fn = require(pluginPath); // eslint-disable-line
        } catch (err) {
          log.error('CONFIG', `Fail to load plugin ${pluginPath}`);
          log.error('CONFIG', err.stack || err.toString());
          process.exit(1);
        }

        return {
          // 插件名称
          name: plugins[0],
          // 插件路径
          pluginPath,
          // 插件函数
          fn: fn.default || fn || ((): void => {}),
          // 插件配置
          options,
        };
      },
    );

    return userPlugins;
  };

  // 所有获取插件信息（仅部分属性）
  public getAllPlugin: IGetAllPlugin = (
    dataKeys = ['pluginPath', 'options', 'name'],
  ) => {
    return this.plugins.map(
      (pluginInfo): Partial<IPluginInfo> => {
        // filter fn to avoid loop
        return _.pick(pluginInfo, dataKeys);
      },
    );
  };

  // 注册 webpack 任务，主要是 webpackChain
  public registerTask: IRegisterTask = (name, chainConfig) => {
    const exist = this.configArr.find((v): boolean => v.name === name);
    if (!exist) {
      this.configArr.push({
        name,
        chainConfig,
        modifyFunctions: [],
      });
    } else {
      throw new Error(`[Error] config '${name}' already exists!`);
    }
  };

  // 获取加入 cancel 的 webpack 任务
  public cancelTask: ICancelTask = name => {
    if (this.cancelTaskNames.includes(name)) {
      log.info('TASK', `task ${name} has already been canceled`);
    } else {
      this.cancelTaskNames.push(name);
    }
  };

  // 注册公用方法
  public registerMethod: IRegisterMethod = (name, fn, options) => {
    if (this.methodRegistration[name]) {
      throw new Error(`[Error] method '${name}' already registered`);
    } else {
      const registration = [fn, options] as [IMethodFunction, IMethodOptions];
      this.methodRegistration[name] = registration;
    }
  };

  // 调用公用方法
  public applyMethod: IApplyMethod = (config, ...args) => {
    const [methodName, pluginName] = Array.isArray(config) ? config : [config];
    if (this.methodRegistration[methodName]) {
      const [registerMethod, methodOptions] = this.methodRegistration[
        methodName
      ];
      if (methodOptions?.pluginName) {
        // 传入 pluginName
        return (registerMethod as IMethodCurry)(pluginName)(...args);
      } else {
        // 直接调用
        return (registerMethod as IMethodRegistration)(...args);
      }
    } else {
      throw new Error(`apply unknown method ${methodName}`);
    }
  };

  // 判断方法是否已注册
  public hasMethod: IHasMethod = name => {
    return !!this.methodRegistration[name];
  };

  // 修改用户配置
  public modifyUserConfig: IModifyUserConfig = (configKey, value, options) => {
    const errorMsg = 'config plugins is not support to be modified';
    const { deepmerge: mergeInDeep } = options || {};
    if (typeof configKey === 'string') {
      // plugins 不允许修改
      if (configKey === 'plugins') {
        throw new Error(errorMsg);
      }
      // 通过 . 来实现递归属性调用 a.b.c => a: { b: { c: 1 } }
      const configPath = configKey.split('.');
      const originalValue = _.get(this.userConfig, configPath);
      // 获取新的 value 值
      const newValue = typeof value !== 'function' ? value : value(originalValue);
      _.set(this.userConfig, configPath, mergeInDeep ? mergeConfig<JsonValue>(originalValue, newValue): newValue);
    } else if (typeof configKey === 'function') {
      // 直接计算一个完整的 userConfig
      const modifiedValue = configKey(this.userConfig);
      if (_.isPlainObject(modifiedValue)) {
        if (Object.prototype.hasOwnProperty.call(modifiedValue, 'plugins')) {
          // remove plugins while it is not support to be modified
          log.verbose('[modifyUserConfig]', 'delete plugins of user config while it is not support to be modified');
          delete modifiedValue.plugins;
        }
        // 设置新的 value 值
        Object.keys(modifiedValue).forEach(modifiedConfigKey => {
          const originalValue = this.userConfig[modifiedConfigKey];
          this.userConfig[modifiedConfigKey] = mergeInDeep ? mergeConfig<JsonValue>(originalValue, modifiedValue[modifiedConfigKey]) : modifiedValue[modifiedConfigKey] ;
        });
      } else {
        throw new Error(`modifyUserConfig must return a plain object`);
      }
    }
  };

  // 修改用户配置注册
  public modifyConfigRegistration: IModifyConfigRegistration = (
    ...args: IModifyRegisteredConfigArgs
  ) => {
    this.modifyConfigRegistrationCallbacks.push(args);
  };

  // 修改 cli 配置注册
  public modifyCliRegistration: IModifyCliRegistration = (
    ...args: IModifyRegisteredCliArgs
  ) => {
    this.modifyCliRegistrationCallbacks.push(args);
  };

  // 获取所有的 webpack 任务
  public getAllTask = (): string[] => {
    return this.configArr.map(v => v.name);
  };

  // 添加 webpack 配置获取监听函数，主要用于 webpack 配置修改
  public onGetWebpackConfig: IOnGetWebpackConfig = (
    ...args: IOnGetWebpackConfigArgs
  ) => {
    this.modifyConfigFns.push(args);
  };

  // 添加 jest 配置获取监听函数，主要用于 jest 配置修改
  public onGetJestConfig: IOnGetJestConfig = (fn: IJestConfigFunction) => {
    this.modifyJestConfig.push(fn);
  };

  public runJestConfig = (jestConfig: Json): Json => {
    let result = jestConfig;
    for (const fn of this.modifyJestConfig) {
      result = fn(result);
    }
    return result;
  };

  // 事件监听函数注册
  public onHook: IOnHook = (key, fn) => {
    if (!Array.isArray(this.eventHooks[key])) {
      this.eventHooks[key] = [];
    }
    this.eventHooks[key].push(fn);
  };

  // 事件监听函数执行，相当于 emit
  public applyHook = async (key: string, opts = {}): Promise<void> => {
    const hooks = this.eventHooks[key] || [];

    for (const fn of hooks) {
      // eslint-disable-next-line no-await-in-loop
      await fn(opts);
    }
  };

  // 设置内部共享值
  public setValue = (key: string | number, value: any): void => {
    this.internalValue[key] = value;
  };

  // 获取内部共享值
  public getValue = (key: string | number): any => {
    return this.internalValue[key];
  };

  // 注册用户配置
  public registerUserConfig = (args: MaybeArray<IUserConfigArgs>): void => {
    this.registerConfig('userConfig', args);
  };

  // 判断是否已注册过配置
  public hasRegistration = (name: string, type: 'cliOption' | 'userConfig' = 'userConfig' ): boolean => {
    const mappedType = type === 'cliOption' ? 'cliOptionRegistration' : 'userConfigRegistration';
    return Object.keys(this[mappedType] || {}).includes(name);
  };

  // 注册 cliOtion 配置
  public registerCliOption = (args: MaybeArray<ICliOptionArgs>): void => {
    this.registerConfig('cliOption', args, name => {
      // 用于将属性名称转换为驼峰格式
      return camelCase(name, { pascalCase: false });
    });
  };

  // 配置解析
  public resolveConfig = async (): Promise<void> => {

    /**
     * userConfig 解析
     */
    this.userConfig = await this.getUserConfig();
    // shallow copy of userConfig while userConfig may be modified
    this.originalUserConfig = { ...this.userConfig };

    /**
     * plugins 解析
     */
    const { plugins = [], getBuiltInPlugins = () => []} = this.options;
    // run getBuiltInPlugins before resolve webpack while getBuiltInPlugins may add require hook for webpack
    const builtInPlugins: IPluginList = [
      ...plugins,
      ...getBuiltInPlugins(this.userConfig),
    ];

    /**
     * 自定义 webpack 引用 
     */
    // custom webpack
    const webpackInstancePath = this.userConfig.customWebpack
      ? require.resolve('webpack', { paths: [this.rootDir] })
      : 'webpack';
    this.webpack = require(webpackInstancePath);
    if (this.userConfig.customWebpack) {
      // 劫持 webpack 解析
      hijackWebpackResolve(this.webpack, this.rootDir);
    }

    // 插件校验
    this.checkPluginValue(builtInPlugins); // check plugins property

    // 插件内容解析
    this.plugins = this.resolvePlugins(builtInPlugins);
  }

  // 插件执行
  private runPlugins = async (): Promise<void> => {
    for (const pluginInfo of this.plugins) {
      const { fn, options, name: pluginName } = pluginInfo;

      // context 仅有部分属性需要传到插件里
      const pluginContext = _.pick(this, PLUGIN_CONTEXT_KEY);

      // 执行注册方法，科里化插件名称
      const applyMethod: IApplyMethodAPI = (methodName, ...args) => {
        return this.applyMethod([methodName, pluginName], ...args);
      };

      const pluginAPI = {
        log,
        context: pluginContext,
        registerTask: this.registerTask,
        getAllTask: this.getAllTask,
        getAllPlugin: this.getAllPlugin,
        cancelTask: this.cancelTask,
        onGetWebpackConfig: this.onGetWebpackConfig,
        onGetJestConfig: this.onGetJestConfig,
        onHook: this.onHook,
        setValue: this.setValue,
        getValue: this.getValue,
        registerUserConfig: this.registerUserConfig,
        hasRegistration: this.hasRegistration,
        registerCliOption: this.registerCliOption,
        registerMethod: this.registerMethod,
        applyMethod,
        hasMethod: this.hasMethod,
        modifyUserConfig: this.modifyUserConfig,
        modifyConfigRegistration: this.modifyConfigRegistration,
        modifyCliRegistration: this.modifyCliRegistration,
      };
      // eslint-disable-next-line no-await-in-loop
      await fn(pluginAPI, options);
    }
  };

  // plugin 属性校验
  private checkPluginValue = (plugins: IPluginList): void => {
    let flag;
    if (!_.isArray(plugins)) {
      flag = false;
    } else {
      flag = plugins.every(v => {
        let correct = _.isArray(v) || _.isString(v) || _.isFunction(v);
        if (correct && _.isArray(v)) {
          correct = _.isString(v[0]);
        }

        return correct;
      });
    }

    if (!flag) {
      throw new Error('plugins did not pass validation');
    }
  };

  // 修改已注册用户配置
  private runConfigModification = async (): Promise<void> => {
    const callbackRegistrations = [
      'modifyConfigRegistrationCallbacks',
      'modifyCliRegistrationCallbacks',
    ];
    callbackRegistrations.forEach(registrationKey => {
      const registrations = this[registrationKey as IRegistrationKey] as (
        | IModifyRegisteredConfigArgs
        | IModifyRegisteredConfigArgs
      )[];
      registrations.forEach(([name, callback]) => {
        const modifyAll = _.isFunction(name);
        const configRegistrations = this[
          registrationKey === 'modifyConfigRegistrationCallbacks'
            ? 'userConfigRegistration'
            : 'cliOptionRegistration'
        ];
        if (modifyAll) {
          const modifyFunction = name as IModifyRegisteredConfigCallbacks<IUserConfigRegistration>;
          const modifiedResult = modifyFunction(configRegistrations);
          Object.keys(modifiedResult).forEach(configKey => {
            configRegistrations[configKey] = {
              ...(configRegistrations[configKey] || {}),
              ...modifiedResult[configKey],
            };
          });
        } else if (typeof name === 'string') {
          if (!configRegistrations[name]) {
            throw new Error(`Config key '${name}' is not registered`);
          }
          const configRegistration = configRegistrations[name];
          configRegistrations[name] = {
            ...configRegistration,
            ...callback(configRegistration),
          };
        }
      });
    });
  };

  // 用户配置执行，用于 webpack 配置更新
  private runUserConfig = async (): Promise<void> => {
    for (const configInfoKey in this.userConfig) {
      // plugins 和 customWebpack 属性无法注册
      if (!['plugins', 'customWebpack'].includes(configInfoKey)) {
        const configInfo = this.userConfigRegistration[configInfoKey];

        // 属性未注册
        if (!configInfo) {
          throw new Error(
            `[Config File] Config key '${configInfoKey}' is not supported`,
          );
        }

        const { name, validation, ignoreTasks } = configInfo;
        const configValue = this.userConfig[name];

        // 属性值校验 
        if (validation) {
          let validationInfo;
          if (_.isString(validation)) {
            // split validation string
            const supportTypes = validation.split('|') as ValidationKey[];
            const validateResult = supportTypes.some(supportType => {
              const fnName = VALIDATION_MAP[supportType];
              if (!fnName) {
                throw new Error(`validation does not support ${supportType}`);
              }
              return _[fnName](configValue);
            });
            assert(
              validateResult,
              `Config ${name} should be ${validation}, but got ${configValue}`,
            );
          } else {
            // eslint-disable-next-line no-await-in-loop
            validationInfo = await validation(configValue);
            assert(
              validationInfo,
              `${name} did not pass validation, result: ${validationInfo}`,
            );
          }
        }

        // 将用户值更新到对应的 webapck 配置上
        if (configInfo.configWebpack) {
          // eslint-disable-next-line no-await-in-loop
          await this.runConfigWebpack(
            configInfo.configWebpack,
            configValue,
            ignoreTasks,
          );
        }
      }
    }
  };

  // 命令行配置执行
  private runCliOption = async (): Promise<void> => {
    for (const cliOpt in this.commandArgs) {
      // allow all jest option when run command test
      if (this.command !== 'test' || cliOpt !== 'jestArgv') {
        const { commands, name, configWebpack, ignoreTasks } =
          this.cliOptionRegistration[cliOpt] || {};
        if (!name || !(commands || []).includes(this.command)) {
          throw new Error(
            `cli option '${cliOpt}' is not supported when run command '${this.command}'`,
          );
        }
        if (configWebpack) {
          // eslint-disable-next-line no-await-in-loop
          await this.runConfigWebpack(
            configWebpack,
            this.commandArgs[cliOpt],
            ignoreTasks,
          );
        }
      }
    }
  };

  // 执行 webpack 配置修改
  private runWebpackFunctions = async (): Promise<void> => {
    this.modifyConfigFns.forEach(([name, func]) => {
      const isAll = _.isFunction(name);
      if (isAll) {
        // modify all
        this.configArr.forEach(config => {
          config.modifyFunctions.push(name as IPluginConfigWebpack);
        });
      } else {
        // modify named config
        this.configArr.forEach(config => {
          if (config.name === name) {
            config.modifyFunctions.push(func);
          }
        });
      }
    });

    for (const configInfo of this.configArr) {
      for (const func of configInfo.modifyFunctions) {
        // eslint-disable-next-line no-await-in-loop
        await func(configInfo.chainConfig);
      }
    }
  };

  public registerCommandModules (moduleKey: string, module: CommandModule<any>): void {
    if (this.commandModules[moduleKey]) {
      log.warn('CONFIG', `command module ${moduleKey} already been registered`);
    }
    this.commandModules[moduleKey] = module;
  }

  // 获取对应命令的执行逻辑
  public getCommandModule (options: { command: CommandName; commandArgs: CommandArgs; userConfig: IUserConfig }): CommandModule<any> {
    const { command } = options;
    if (this.commandModules[command]) {
      return this.commandModules[command];
    } else {
      throw new Error(`command ${command} is not support`);
    }
  };

  // webpack 任务和配置初始化
  public setUp = async (): Promise<ITaskConfig[]> => {
    await this.resolveConfig();
    await this.runPlugins();
    await this.runConfigModification();
    await this.runUserConfig();
    await this.runWebpackFunctions();
    await this.runCliOption();

    // 过滤被取消掉的 webpack 任务
    // filter webpack config by cancelTaskNames
    this.configArr = this.configArr.filter(
      config => !this.cancelTaskNames.includes(config.name),
    );
    return this.configArr;
  };

  public getWebpackConfig = (): ITaskConfig[] => {
    return this.configArr;
  };

  // 主逻辑执行
  public run = async <T, P>(options?: T): Promise<P> => {
    const { command, commandArgs } = this;
    log.verbose(
      'OPTIONS',
      `${command} cliOptions: ${JSON.stringify(commandArgs, null, 2)}`,
    );
    try {
      await this.setUp();
    } catch (err) {
      log.error('CONFIG', chalk.red('Failed to get config.'));
      await this.applyHook(`error`, { err });
      throw err;
    }
    const commandModule = this.getCommandModule({ command, commandArgs, userConfig: this.userConfig });
    return commandModule(this, options);
  }
}

export default Context;
