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
    await sleep(300);
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
        .sleep(200);
    const process = AsyncProcess_1.AsyncProcess.of([1, 2, 3])
        .map(mapper)
        .forEach(show_slowly)
        .value(100)
        .value(_ => mapper)
        .log(_ => _)
        .rollback(async (ctx) => {
        // ctx.value has the process resolved value
    });
    return process;
}
function call_comp() {
    const mapper = AsyncProcess_1.AsyncProcess.of().value(_ => _ * 5);
    const value = AsyncProcess_1.AsyncProcess.of(AsyncProcess_1.AsyncProcess.of(50).value(_ => _ + 1));
    return AsyncProcess_1.AsyncProcess.of().call(mapper, value)
        .log(_ => `call_comp : ${_}`);
}
function call_comp2() {
    const mapper = AsyncProcess_1.AsyncProcess.of().value(_ => _ * 5);
    const value = AsyncProcess_1.AsyncProcess.of(50);
    return AsyncProcess_1.AsyncProcess.of(value).call(mapper)
        .log(_ => `call_comp2 : ${_}`);
}
function test_calling() {
    const mapper = AsyncProcess_1.AsyncProcess.of(12345);
    const value = AsyncProcess_1.AsyncProcess.of(AsyncProcess_1.AsyncProcess.of(AsyncProcess_1.AsyncProcess.of(50)
        .sleep(200)
        .log('reading the value ...')
        .sleep(1200)));
    // const value = AsyncProcess.of( AsyncProcess.of( 50 ) )
    // const value2 = AsyncProcess.of( AsyncProcess.of( 60 ) )
    return AsyncProcess_1.AsyncProcess.of(value).call(mapper)
        .log(_ => `call_comp3 : ${_}`)
        .log('test calling with normal function')
        .call(async (_) => {
        console.log("VALUE ", _);
    })
        .call(_ => {
        console.log("VALUE ", _);
    })
        .call(_ => {
        console.log("VALUE ", _);
    }, 'Set Value!')
        .call(async (_) => {
        console.log("VALUE ", _);
    }, value)
        .call(async (_) => {
        console.log("VALUE Again ", _);
    }, value);
}
AsyncProcess_1.AsyncProcess.of()
    .add(user_test())
    .add(simple_test())
    .add(call_comp())
    .add(call_comp2())
    .add(test_calling())
    .start();
//# sourceMappingURL=test_process.js.map