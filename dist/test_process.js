"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AsyncProcess_1 = require("./AsyncProcess");
// promisified sleep for testing...
function sleep(ms) {
    return new Promise((r) => {
        setTimeout(r, ms);
    });
}
const findUser = AsyncProcess_1.AsyncProcess.of()
    .code(async (ctx) => {
    const id = ctx.value;
    console.log(`Fetching user ${id} from database :)`);
    await sleep(1000);
    return {
        id: id,
        name: `user ${id}`
    };
})
    .rollback(async (ctx) => {
    console.log('could rollback the user op for ', ctx.value);
});
function user_test() {
    return AsyncProcess_1.AsyncProcess.of([1, 2, 3])
        .map(findUser) // fetch users from DB using function or process
        .value(_ => {
        // Do whatever you want with the values...
    })
        .forEach(_ => console.log(`${JSON.stringify(_)}`))
        .value([1, 2, 3, 4])
        .map(value => value * 2)
        .log(_ => `${_}`)
        .map(async (value) => value * 10)
        .log(_ => `${_}`)
        .value([2, 4, 6, 8])
        .map(AsyncProcess_1.AsyncProcess.of().value(_ => _ * 20).rollback(async (ctx) => {
        console.log('rollback of value ', ctx.value);
    }))
        .log(_ => `${_}`);
}
function simple_test() {
    const mapper = AsyncProcess_1.AsyncProcess.of().value(_ => _ * 15);
    const show_slowly = AsyncProcess_1.AsyncProcess.of()
        .log(_ => _)
        .sleep(1000);
    const process = AsyncProcess_1.AsyncProcess.of([1, 2, 3])
        .map(mapper)
        .forEach(show_slowly)
        .rollback(async (ctx) => {
        // ctx.value has the process resolved value
    });
    return process;
}
AsyncProcess_1.AsyncProcess.of()
    .add(user_test())
    .add(simple_test())
    .start();
//# sourceMappingURL=test_process.js.map