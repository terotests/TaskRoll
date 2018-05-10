"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AsyncProcess_1 = require("./AsyncProcess");
// promisified sleep for testing...
function sleep(ms) {
    return new Promise((r) => {
        setTimeout(r, ms);
    });
}
async function findUser(id) {
    console.log(`Fetching user ${id} from database :)`);
    await sleep(1000);
    return {
        id: id,
        name: `user ${id}`
    };
}
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
    return AsyncProcess_1.AsyncProcess.of([1, 2, 3])
        .log('starting simple_test')
        .sleep(2000)
        .map(_ => _ * 2)
        .forEach(_ => {
        console.log(_);
    })
        .code(_ => {
        return 20000;
    })
        .log(_ => _);
}
AsyncProcess_1.AsyncProcess.of()
    .add(user_test())
    .add(simple_test())
    .start();
//# sourceMappingURL=test_process.js.map