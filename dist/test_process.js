"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AsyncProcess_1 = require("./AsyncProcess");
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
        .map(findUser) // whatever, database etc.
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
user_test().start();
//# sourceMappingURL=test_process.js.map