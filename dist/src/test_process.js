"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const TaskRoll_1 = __importDefault(require("./TaskRoll"));
const fluture_1 = __importDefault(require("fluture"));
// promisified sleep for testing...
function sleep(ms) {
    return new Promise((r) => {
        setTimeout(r, ms);
    });
}
const findUser = TaskRoll_1.default.of()
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
    return TaskRoll_1.default.of([1, 2, 3])
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
        .map(TaskRoll_1.default.of().value(_ => _ * 20).rollback(async (ctx) => {
        console.log('rollback of value ', ctx.value);
    }))
        .log(_ => `${_}`);
}
function simple_test() {
    const mapper = TaskRoll_1.default.of().value(_ => _ * 15);
    const show_slowly = TaskRoll_1.default.of()
        .log(_ => _)
        .sleep(200);
    const process = TaskRoll_1.default.of([1, 2, 3])
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
    const mapper = TaskRoll_1.default.of().value(_ => _ * 5);
    const value = TaskRoll_1.default.of(TaskRoll_1.default.of(50).value(_ => _ + 1));
    return TaskRoll_1.default.of().call(mapper, value)
        .log(_ => `call_comp : ${_}`);
}
function call_comp2() {
    const mulBy10 = TaskRoll_1.default.of().value(_ => _ * 10);
    const mapper = TaskRoll_1.default.of().value(_ => mulBy10);
    const value = TaskRoll_1.default.of(50);
    return TaskRoll_1.default.of(value).call(mapper)
        .log(_ => `call_comp2 50 x 10 : ${_}`);
}
function call_comp2_variant() {
    const mulBy5 = TaskRoll_1.default.of().value(_ => _ * 5).log('5 x is slow :)').sleep(1000);
    const mulBy10 = TaskRoll_1.default.of().value(_ => _ * 10);
    return TaskRoll_1.default.of(50)
        .value(mulBy10)
        .value(mulBy5)
        .value(mulBy5)
        .log(_ => `${_} == 50 x 10 x 5 x 5`);
}
function test_calling() {
    const mapper = TaskRoll_1.default.of(12345);
    // test re-using composed lazy value reading as parameter
    const value = TaskRoll_1.default.of(TaskRoll_1.default.of(TaskRoll_1.default.of(50)
        .sleep(200)
        .log('reading the value ...')
        .sleep(1200)));
    // const value = TaskRoll.of( TaskRoll.of( 50 ) )
    // const value2 = TaskRoll.of( TaskRoll.of( 60 ) )
    return TaskRoll_1.default.of(value).call(mapper)
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
async function fails(value) {
    throw "Problem!!! " + value;
}
async function tester() {
    try {
        await TaskRoll_1.default.of('message...').log(_ => _).value(async (foo) => {
            return TaskRoll_1.default.of().log('Was Called...').sleep(1000);
        }).chain(_ => _).commit().rollback(async (_) => {
            console.log('task Rollback');
        }).toPromise();
        const longer_than_5 = TaskRoll_1.default.of().chain(_ => _.length > 5);
        const compare = TaskRoll_1.default.of()
            .cond(longer_than_5, TaskRoll_1.default.of().log(_ => `${_}.length > 5`), TaskRoll_1.default.of().log(_ => `${_}.length <= 5`));
        const compare2 = TaskRoll_1.default.of()
            .cond(_ => _.length > 5, TaskRoll_1.default.of().log(_ => `${_}.length > 5`), TaskRoll_1.default.of().log(_ => `${_}.length <= 5`));
        const compare3 = TaskRoll_1.default.of()
            .cond(async (_) => _.length > 5, TaskRoll_1.default.of().log(_ => `${_}.length > 5`).value('long'), TaskRoll_1.default.of().log(_ => `${_}.length <= 5`).value('short'));
        await TaskRoll_1.default.of(['ABC', 'Chevy Van', 'Trekk'])
            .log('calling the map...')
            .log('...')
            .map(compare)
            .log('...')
            .map(compare2)
            .log('...')
            .map(compare3).log(_ => _)
            .log('compare done!')
            .sleep(2000)
            .toPromise();
        // test stack overflow
        console.time('TaskRoll');
        const add1 = x => x + 1;
        var m = TaskRoll_1.default.of(1);
        const array1 = [];
        for (var i = 0; i < 100000; i++) {
            array1.push(i);
            // m = m.value(add1);
        }
        m.value(array1).map(add1);
        m.commit();
        m.log(_ => `100000 adds == ${_.length}`);
        await m.toPromise();
        // console.log( await m.toPromise() )
        console.timeEnd('TaskRoll');
        console.time('fluture');
        var add2 = x => x + 1;
        var m2 = fluture_1.default.of(1);
        for (var i = 0; i < 10000; i++) {
            m2 = m2.map(add2);
        }
        m2.fork(console.error, console.log);
        console.timeEnd('fluture');
        try {
            await TaskRoll_1.default.of(5).chain(_ => {
                throw "Whaat!!!!";
            }).rollback(async (_) => {
                console.log("... rolling ...");
            }).toPromise();
        }
        catch (e) {
            console.log('--- error which should be caught ---');
            console.log(e);
        }
        await TaskRoll_1.default.of(5)
            .fork(p => {
            p.log('Testing forked processs');
            p.sleep(2000);
            p.rollback(async (_) => {
                console.log('The Child process Fork Rollback');
            });
        })
            .sleep(1000)
            .log('Retuned to the Parent Process...')
            .sleep(2000)
            .rollback(async (_) => {
            console.log('task 5 Rollback');
        }).toPromise();
        console.log(await TaskRoll_1.default.of('Promised value!').log('promisified').sleep(1000).log('done').toPromise());
        const result = await TaskRoll_1.default.of()
            .add(user_test())
            .add(simple_test())
            .add(call_comp())
            .add(call_comp2())
            .add(call_comp2_variant())
            .add(test_calling())
            .rollback(async (_) => {
            console.log('TaskRoll ends');
        })
            .toPromise();
        console.log('the evaluation result was ', result);
    }
    catch (e) {
    }
}
tester();
//# sourceMappingURL=test_process.js.map