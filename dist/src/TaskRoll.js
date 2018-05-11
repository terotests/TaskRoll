"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var TaskRollType;
(function (TaskRollType) {
    TaskRollType[TaskRollType["Sequential"] = 1] = "Sequential";
    TaskRollType[TaskRollType["Parallel"] = 2] = "Parallel";
    TaskRollType[TaskRollType["Race"] = 3] = "Race";
    TaskRollType[TaskRollType["Loop"] = 4] = "Loop";
    TaskRollType[TaskRollType["Catch"] = 5] = "Catch";
    TaskRollType[TaskRollType["Background"] = 6] = "Background";
})(TaskRollType = exports.TaskRollType || (exports.TaskRollType = {}));
var TaskRollState;
(function (TaskRollState) {
    TaskRollState[TaskRollState["Begin"] = 1] = "Begin";
    TaskRollState[TaskRollState["Pending"] = 2] = "Pending";
    TaskRollState[TaskRollState["Running"] = 3] = "Running";
    TaskRollState[TaskRollState["Cancelled"] = 4] = "Cancelled";
    TaskRollState[TaskRollState["Resolved"] = 5] = "Resolved";
    TaskRollState[TaskRollState["Rejected"] = 6] = "Rejected";
})(TaskRollState = exports.TaskRollState || (exports.TaskRollState = {}));
function sleep(ms) {
    return new Promise((r) => {
        setTimeout(r, ms);
    });
}
class TaskRollCtx {
    serialize() {
        const s = {};
        Object.keys(this.state).forEach(key => {
            if (!(this.state[key] instanceof TaskRoll)) {
                s[key] = this.state[key];
            }
        });
        return {
            value: this.value,
            state: s,
        };
    }
    constructor(value, parent, params, task) {
        this.value = value;
        this.parent = parent;
        this.params = params;
        this.task = task;
        this.state = {};
    }
    _copy() {
        const n = new TaskRollCtx();
        n.value = this.value;
        n.parent = this.parent;
        n.task = this.task;
        n.params = this.params;
        n.thread = this.thread;
        n.state = this.state;
        return n;
    }
    getState(name) {
        return this.state[name];
    }
    reduceState(value) {
        const o = this._copy();
        o.state = Object.assign({}, this.state, value);
        return o;
    }
    setState(name, value) {
        const o = this._copy();
        o.state = Object.assign({}, this.state, { [name]: value });
        return o;
    }
    setThread(thread) {
        const o = this._copy();
        o.thread = thread;
        return o;
    }
    setTask(task) {
        const o = this._copy();
        o.task = task;
        return o;
    }
    setValue(value) {
        const o = this._copy();
        o.value = value;
        return o;
    }
    setParent(parent) {
        const o = this._copy();
        o.parent = parent;
        return o;
    }
    setParams(params) {
        const o = this._copy();
        o.params = params;
        return o;
    }
    resolve(value) {
        if (value instanceof TaskRollCtx) {
            this.parent.resolve(value);
            return;
        }
        if (typeof (value) != 'undefined') {
            this.parent.resolve(this.setValue(value));
        }
        else {
            this.parent.resolve(this);
        }
    }
    reject() {
        this.parent.reject(this);
    }
}
exports.TaskRollCtx = TaskRollCtx;
class TaskRoll {
    constructor(cbs) {
        this.index = -1;
        this.type = TaskRollType.Sequential;
        this.state = TaskRollState.Begin;
        this.closeAtEnd = false;
        this.shutdown = false;
        this.isolated = false;
        this.committed = false;
        this.name = '';
        this.children = [];
        this.spawned = [];
        this.onFulfilledHandlers = [];
        this.type = TaskRollType.Sequential;
        this.result = new TaskRollCtx();
        if (cbs) {
            this.executeTask = cbs.executeTask || this.executeTask;
            this.onCleanup = cbs.onCleanup || this.onCleanup;
            this.onCancel = cbs.onCancel || this.onCancel;
            this.name = cbs.name || this.name;
        }
    }
    static of(value) {
        const p = new TaskRoll({ name: 'of' });
        if (typeof value === 'undefined')
            return p;
        return p.value(value);
    }
    clone() {
        const c = new TaskRoll();
        c.type = this.type;
        c.children = this.children.map(c => c.clone());
        c.isolated = this.isolated;
        c.name = this.name;
        c.executeTask = this.executeTask;
        c.onCancel = this.onCancel;
        c.onCleanup = this.onCleanup;
        return c;
    }
    commit() {
        this.code(_ => {
            this.committed = true;
        });
        return this;
    }
    log(msg) {
        return this.code(_ => {
            if (typeof (msg) === 'function') {
                console.log(msg(_.value));
            }
            else {
                console.log(msg);
            }
        }, 'log');
    }
    sleep(ms) {
        return this.code((_) => __awaiter(this, void 0, void 0, function* () {
            yield sleep(ms);
        }), 'sleep');
    }
    add(o) {
        this.children.push(o);
        return this;
    }
    fork(build) {
        const o = new TaskRoll();
        o.isolated = true;
        o.name = 'fork';
        build(o);
        this.children.push(o);
        return this;
    }
    process(build) {
        const o = new TaskRoll();
        build(o);
        this.children.push(o);
        return this;
    }
    valueFrom(name) {
        this.children.push(new TaskRoll({
            name: `valueFrom ${name}`,
            executeTask(c) {
                c.resolve(c.getState(name));
            }
        }));
        return this;
    }
    valueTo(name) {
        this.children.push(new TaskRoll({
            name: `valueTo ${name}`,
            executeTask(c) {
                const newCtx = c.setState(name, c.value);
                c.parent.resolve(newCtx);
            }
        }));
        return this;
    }
    chain(value) {
        return this.value(value);
    }
    value(value) {
        if (typeof value === 'function') {
            const p = new TaskRoll();
            p.code(ctx => value(ctx.value));
            this.children.push(p);
            return this;
        }
        this.children.push(new TaskRoll({
            name: `value`,
            executeTask(c) {
                if (typeof (value) == 'function') {
                    c.resolve(value(c.value));
                    return;
                }
                if (value instanceof TaskRoll) {
                    return value.clone();
                }
                c.resolve(value);
            }
        }));
        return this;
    }
    background(build) {
        const o = new TaskRoll();
        o.type = TaskRollType.Background;
        build(o);
        this.children.push(o);
        return this;
    }
    parallel(build) {
        const o = new TaskRoll();
        o.type = TaskRollType.Parallel;
        build(o);
        this.children.push(o);
        return this;
    }
    forEach(fn, name) {
        const o = new TaskRoll();
        o.isolated = true;
        o.name = 'forEach' + (name ? ' ' + name : '');
        o.executeTask = function (ctx) {
            const mapProcess = new TaskRoll();
            mapProcess.isolated = true;
            if (typeof fn === 'function') {
                return mapProcess.value(ctx.value).code(ctx => {
                    return Promise.all(ctx.value.map(fn));
                    // return ctx.value.map(fn)
                });
            }
            return TaskRoll.of(ctx.value)
                .fork(p => {
                for (let value of ctx.value) {
                    p.call(fn, value);
                }
            });
        };
        this.children.push(o);
        return this;
    }
    cleanup(fn) {
        this.onCleanup = fn;
        return this;
    }
    rollback(fn) {
        this.onCancel = fn;
        return this;
    }
    map(fn) {
        const o = new TaskRoll();
        o.name = 'map';
        o.executeTask = function (ctx) {
            if (typeof fn === 'function') {
                return TaskRoll.of(ctx.value).code(ctx => {
                    return Promise.all(ctx.value.map(fn));
                });
            }
            if (fn instanceof TaskRoll) {
                o.name = o.name + ' ' + (fn.name || '');
            }
            return TaskRoll.of(ctx.value)
                .process(p => {
                const items = [];
                for (let value of ctx.value) {
                    p.call(fn, value);
                    p.code(_ => {
                        items.push(_.value);
                    });
                }
                p.code(_ => {
                    return items;
                });
            });
        };
        this.children.push(o);
        return this;
    }
    code(fn, name) {
        const o = new TaskRoll();
        o.setName(name || 'code');
        o.executeTask = function (ctx) {
            try {
                const new_value = fn(ctx);
                if (new_value instanceof TaskRoll) {
                    return new_value;
                }
                // resolve promise from code
                if (new_value && new_value.then) {
                    new_value.then(_ => ctx.resolve(_));
                    return;
                }
                if (typeof (new_value) != 'undefined') {
                    ctx.resolve(new_value);
                }
                else {
                    ctx.parent.resolve(ctx);
                }
            }
            catch (e) {
                console.error(e);
                ctx.parent.reject(ctx);
            }
        };
        this.children.push(o);
        return this;
    }
    fn(name, fnCode) {
        this.code(ctx => {
            // should be using the scope
            ctx.resolve(ctx.setState(name, fnCode));
        }, `fn: ${name}`);
        return this;
    }
    setName(name) {
        if (typeof (name) == 'string')
            this.name = name;
        if (name instanceof TaskRoll)
            this.name = name.name;
        return this;
    }
    // TODO: handle call 
    call(name, givenParams) {
        this.code(ctx => {
            let fn;
            let params = givenParams;
            if (typeof name == 'string')
                fn = ctx.getState(name);
            if (name instanceof TaskRoll)
                fn = name.clone();
            if (params instanceof TaskRoll)
                params = givenParams.clone();
            if (typeof name == 'function') {
                return TaskRoll.of(params).value(_ => name(_));
            }
            if (typeof params === 'function') {
                return TaskRoll.of().code(_ => {
                    return params(ctx.value);
                }, name).setName(name).add(fn.clone());
            }
            if (typeof params !== 'undefined') {
                return TaskRoll.of(params).setName(name).add(fn.clone());
            }
            return fn.clone().setName(name);
        }, `${name.name || name}()`);
        return this;
    }
    resolve(ctx) {
        // can not resolve many times
        if (ctx.task.state == TaskRollState.Resolved || ctx.task.state == TaskRollState.Rejected) {
            return;
        }
        if (this.state != TaskRollState.Running) {
            return;
        }
        ctx.task.state = TaskRollState.Resolved;
        // The result is for both the thread and the task where it was spawned from 
        ctx.thread.result = ctx;
        ctx.task.result = ctx;
        this.result = ctx;
        try {
            if (ctx.task.onCleanup)
                ctx.task.onCleanup(ctx);
        }
        catch (e) {
            this.endWithError(ctx);
            return;
        }
        const parallels_exited = (key, task) => {
            if (!task)
                return true;
            if (task.type != TaskRollType.Parallel)
                return true;
            if (task.type == TaskRollType.Parallel && task.state == TaskRollState.Running)
                return false;
            return parallels_exited(key, task[key]);
        };
        if (ctx.task) {
            if (ctx.task.type == TaskRollType.Parallel) {
                if (parallels_exited('prev', ctx.task) && parallels_exited('next', ctx.task)) {
                    this.step(ctx);
                }
                return;
            }
            // step only if this is the last active task
            if (this.children.indexOf(ctx.task) == this.index) {
                this.step(ctx);
            }
        }
    }
    reject(ctx) {
        if (ctx.task.state !== TaskRollState.Running) {
            return;
        }
        this.endWithError(ctx);
    }
    _start(ctx) {
        if (this.state !== TaskRollState.Begin)
            return;
        this.index = -1;
        this.state = TaskRollState.Running;
        this.children.forEach((item, index) => {
            item.next = this.children[index + 1];
            item.prev = index > 0 ? this.children[index - 1] : null;
        });
        this.step(this.ctx);
    }
    run(ctx) {
        this.ctx = ctx || new TaskRollCtx();
        this._start(this.ctx);
    }
    reset(ctx) {
        this.index = -1;
        this.state = TaskRollState.Begin;
        this.shutdown = false;
        this.spawned = [];
        this.children.forEach(ch => {
            ch.state = TaskRollState.Begin;
            ch.reset(ctx);
        });
    }
    executeTask(ctx) {
        if (this.state === TaskRollState.Resolved) {
            // TODO: how to use already resolved value like promises do
            return;
        }
        if (this.state === TaskRollState.Rejected)
            return;
        this.state = TaskRollState.Begin;
        this.run(ctx);
    }
    step(ctx) {
        if (this.state !== TaskRollState.Running) {
            return;
        }
        if ((this.index + 1) >= this.children.length) {
            if (this.type == TaskRollType.Background) {
                this.state = TaskRollState.Begin;
                this.reset(this.ctx);
                this.run(this.ctx);
                return;
            }
            // this.state = TaskRollState.Resolved
            process.nextTick(_ => {
                this.endGracefully(ctx);
            });
            return;
        }
        const nextTask = this.children[this.index + 1];
        if (!nextTask || nextTask.state !== TaskRollState.Begin) {
            // if the task was resolved return the resolved value
            if (nextTask.state == TaskRollState.Resolved) {
                process.nextTick(_ => {
                    ctx.resolve(nextTask.result.value);
                });
            }
            return;
        }
        this.index = this.index + 1;
        nextTask.state = TaskRollState.Running;
        const resolve_task = (nextTask) => {
            nextTask.state = TaskRollState.Running;
            let anotherTask = nextTask.executeTask(ctx.setParent(this).setTask(nextTask).setThread(nextTask));
            while (anotherTask) {
                anotherTask.state = TaskRollState.Running;
                nextTask.spawned.push(anotherTask);
                anotherTask = anotherTask.executeTask(ctx.setParent(this).setTask(nextTask).setThread(anotherTask));
            }
        };
        switch (nextTask.type) {
            case TaskRollType.Sequential:
                process.nextTick(_ => {
                    try {
                        resolve_task(nextTask);
                    }
                    catch (e) {
                        console.error(e);
                        this.endWithError(ctx);
                    }
                });
                break;
            case TaskRollType.Background:
                process.nextTick(_ => {
                    try {
                        resolve_task(nextTask);
                        this.step(ctx);
                    }
                    catch (e) {
                        console.error(e);
                        this.endWithError(ctx);
                    }
                });
                break;
            case TaskRollType.Parallel:
                // start taxk and move forward
                const idx = this.index;
                process.nextTick(_ => {
                    try {
                        resolve_task(nextTask);
                        const peekTask = this.children[idx + 1];
                        if (peekTask && peekTask.type == TaskRollType.Parallel) {
                            this.step(ctx);
                        }
                        if (!peekTask)
                            this.step(ctx);
                    }
                    catch (e) {
                        console.error(e);
                        this.endWithError(ctx);
                    }
                });
                break;
        }
    }
    stopChildren(state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.committed)
                return;
            // close any running process
            const stop_task = (ch) => __awaiter(this, void 0, void 0, function* () {
                if (ch.committed)
                    return;
                if (ch.state == TaskRollState.Running) {
                    yield ch.stopChildren(state);
                    try {
                        if (ch.onCleanup)
                            yield ch.onCleanup(ch.result);
                        if (ch.onCancel)
                            yield ch.onCancel(ch.result);
                    }
                    catch (e) {
                    }
                    ch.state = state;
                }
                else {
                    if (ch.state != TaskRollState.Begin) {
                        yield ch.stopChildren(state);
                        try {
                            if (ch.state != TaskRollState.Rejected && ch.onCancel)
                                yield ch.onCancel(ch.result);
                        }
                        catch (e) {
                        }
                        ch.state = state;
                    }
                }
            });
            const list = this.children.slice().reverse();
            for (let ch of list) {
                const spawned = ch.spawned.slice().reverse();
                for (let spwn of spawned) {
                    yield stop_task(spwn);
                }
                yield stop_task(ch);
            }
        });
    }
    cleanChildren(state) {
        return __awaiter(this, void 0, void 0, function* () {
            const list = this.children.slice().reverse();
            const clean_task = (ch) => __awaiter(this, void 0, void 0, function* () {
                if (ch.state == TaskRollState.Running) {
                    yield ch.cleanChildren(state);
                    try {
                        if (ch.onCleanup)
                            yield ch.onCleanup(ch.result);
                    }
                    catch (e) {
                        // TODO: what to do if cleanup fails ? 
                    }
                    ch.state = state;
                }
            });
            for (let ch of list) {
                const spawned = ch.spawned.slice().reverse();
                for (let spwn of spawned) {
                    yield clean_task(spwn);
                }
                yield clean_task(ch);
            }
        });
    }
    onFulfilled(fn) {
        if (this.state == TaskRollState.Resolved || this.state == TaskRollState.Rejected) {
            fn(this.ctx);
            return;
        }
        this.onFulfilledHandlers.push(fn);
        return this;
    }
    endGracefully(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.closeAtEnd) {
                yield this.stopChildren(TaskRollState.Resolved);
            }
            else {
                yield this.cleanChildren(TaskRollState.Resolved);
            }
            if (this.ctx.parent) {
                // console.log("Does have parent")
                if (this.isolated) {
                    // continue using the same value which was in the ctx previously
                    this.ctx.parent.resolve(this.ctx.reduceState(ctx.state));
                }
                else {
                    this.ctx.parent.resolve(this.ctx.setValue(ctx.value).reduceState(ctx.state));
                }
            }
            this.state = TaskRollState.Resolved;
            if (this.onCleanup)
                this.onCleanup(this.result);
            try {
                if (this.closeAtEnd && this.onCancel)
                    this.onCancel(this.result);
            }
            catch (e) {
            }
            this.onFulfilledHandlers.forEach(fn => fn(this.ctx));
        });
    }
    endWithError(ctx) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.shutdown) {
                // wait until state become shutdown
                while (this.shutdown) {
                    yield sleep(100);
                }
                return;
            }
            if (this.state == TaskRollState.Rejected) {
                return;
            }
            // find the uppermost parent to shut down...
            if (this.ctx.parent) {
                this.ctx.parent.endWithError(this.ctx.parent.ctx);
                return;
            }
            this.shutdown = true;
            yield this.stopChildren(TaskRollState.Rejected);
            try {
                if (this.onCancel && !this.committed)
                    this.onCancel(this.result);
            }
            catch (e) {
                // if onCancel fails there could be trouble, should be noted somehow
            }
            this.shutdown = false;
            this.state = TaskRollState.Rejected;
            this.onFulfilledHandlers.forEach(fn => fn(this.ctx));
        });
    }
    serialize() {
        const walk_process = (p) => {
            return {
                name: p.name,
                initCtx: p.ctx && p.ctx.serialize() || null,
                resultCtx: p.result && p.result.serialize() || null,
                state: p.state,
                type: p.type,
                index: p.index,
                closeAtEnd: p.closeAtEnd,
                shutdown: p.shutdown,
                isolated: p.isolated,
                committed: p.committed,
                children: p.children.map(walk_process),
                spawned: p.spawned.map(walk_process)
            };
        };
        return walk_process(this);
    }
    start(ctx) {
        // do not bind to node.js process automatically this time
        /*
        process.on('SIGINT', async () => {
          console.log("SIGINT")
          await this.endWithError(this.ctx)
          process.exit()
        });
        process
          .on('unhandledRejection', async (reason, p) => {
            console.error(reason, 'Unhandled Rejection at Promise', p);
            await this.endWithError(this.ctx)
          })
          .on('uncaughtException', async err => {
            console.error(err, 'Uncaught Exception thrown');
            await this.endWithError(this.ctx)
            process.exit(1);
          });
        */
        this.ctx = ctx || new TaskRollCtx();
        this.closeAtEnd = true;
        this._start(this.ctx);
    }
}
exports.default = TaskRoll;
//# sourceMappingURL=TaskRoll.js.map