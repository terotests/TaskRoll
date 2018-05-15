export declare enum TaskRollType {
    Sequential = 1,
    Parallel = 2,
    Race = 3,
    Loop = 4,
    Catch = 5,
    Background = 6,
}
export declare type cleanupFnWithCtx = (ctx?: TaskRollCtx) => Promise<void>;
export declare type cleanupFnWithoutCtx = () => Promise<void>;
export declare type cleanupFn = cleanupFnWithCtx;
export declare type AnyFunction = (item: any) => any;
export declare type readyFnHandler = (ctx?: TaskRollCtx) => any;
export interface ProcessCallbacks {
    onCleanup?: cleanupFn;
    onCancel?: cleanupFn;
    executeTask?: (ctx: TaskRollCtx) => any;
    name?: string;
}
export declare type TaskRollFn = () => TaskRoll;
export declare enum TaskRollState {
    Begin = 1,
    Pending = 2,
    Running = 3,
    Cancelled = 4,
    Resolved = 5,
    Rejected = 6,
}
export declare class TaskRollCtx {
    value: any;
    parent: TaskRoll;
    task: TaskRoll;
    thread: TaskRoll;
    params: any;
    state: any;
    serialize(): Object;
    constructor(value?: any, parent?: TaskRoll, params?: any, task?: TaskRoll);
    _copy(): TaskRollCtx;
    getState(name: string): any;
    reduceState(value: any): TaskRollCtx;
    setState(name: string, value: any): TaskRollCtx;
    setThread(thread: TaskRoll): TaskRollCtx;
    setTask(task: TaskRoll): TaskRollCtx;
    setValue(value: any): TaskRollCtx;
    setParent(parent: TaskRoll): TaskRollCtx;
    setParams(params: any): TaskRollCtx;
    resolve(value?: any): void;
    reject(value?: any): void;
}
export default class TaskRoll {
    index: number;
    taskIndex: number;
    type: TaskRollType;
    state: TaskRollState;
    children: Array<TaskRoll>;
    spawned: Array<TaskRoll>;
    ctx: TaskRollCtx;
    result: TaskRollCtx;
    onFulfilledHandlers: Array<readyFnHandler>;
    next: TaskRoll;
    prev: TaskRoll;
    closeAtEnd: boolean;
    shutdown: boolean;
    isolated: boolean;
    committed: boolean;
    name: string;
    onCancel: cleanupFn;
    onCleanup: cleanupFn;
    constructor(cbs?: ProcessCallbacks);
    static of(value?: any): TaskRoll;
    clone(): TaskRoll;
    commit(): TaskRoll;
    log(msg: string | AnyFunction): TaskRoll;
    sleep(ms: number): TaskRoll;
    add(o: TaskRoll): TaskRoll;
    fork(build: (p: TaskRoll) => void): TaskRoll;
    process(build: (p: TaskRoll) => void): TaskRoll;
    valueFrom(name: string): TaskRoll;
    valueTo(name: string): TaskRoll;
    chain(value: any | AnyFunction | TaskRoll): TaskRoll;
    value(value: any | AnyFunction | TaskRoll): TaskRoll;
    background(build: (p: TaskRoll) => void): TaskRoll;
    parallel(build: (p: TaskRoll) => void): TaskRoll;
    forEach(fn: AnyFunction | TaskRollFn | TaskRoll, name?: string): TaskRoll;
    cleanup(fn: cleanupFnWithCtx): TaskRoll;
    rollback(fn: cleanupFnWithCtx): TaskRoll;
    cond(condition: AnyFunction | TaskRollFn | TaskRoll, fn: AnyFunction | TaskRollFn | TaskRoll | any, elseFn?: any): TaskRoll;
    map(fn: AnyFunction | TaskRollFn | TaskRoll | any): TaskRoll;
    code(fn: (ctx: TaskRollCtx) => any, name?: string): TaskRoll;
    fn(name: string, fnCode: TaskRoll): TaskRoll;
    setName(name: string | any): TaskRoll;
    call(name: string | any, givenParams?: AnyFunction | any): TaskRoll;
    resolve(ctx: TaskRollCtx): void;
    reject(ctx: TaskRollCtx): void;
    _start(ctx: TaskRollCtx): void;
    run(ctx?: TaskRollCtx): void;
    reset(ctx: TaskRollCtx): void;
    executeTask(ctx: TaskRollCtx): TaskRoll | undefined | void;
    step(ctx: TaskRollCtx): void;
    stopChildren(state: TaskRollState): Promise<void>;
    cleanChildren(state: TaskRollState): Promise<void>;
    onFulfilled(fn: readyFnHandler): TaskRoll;
    endGracefully(ctx: TaskRollCtx): Promise<void>;
    endWithError(ctx: TaskRollCtx): Promise<void>;
    serialize(): Object;
    start(ctx?: TaskRollCtx): void;
    toPromise(): Promise<any>;
}
