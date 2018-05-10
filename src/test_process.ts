import { AsyncProcess, AsyncProcessCtx } from './AsyncProcess'

function sleep (ms:number) : Promise<any> {
  return new Promise( (r) => {
    setTimeout(r, ms)
  })
}

async function findUser(id) {
  console.log(`Fetching user ${id} from database :)`)
  await sleep(1000)
  return {
    id : id,
    name : `user ${id}`
  }
}

function user_test() : AsyncProcess {
  return AsyncProcess.of([1,2,3])
    .map(findUser) // whatever, database etc.
    .forEach( _ => console.log(`${JSON.stringify(_)}`))
    .value([1,2,3,4])
    // map using simple function
    .map( value => value * 2)
    .log( _ => `${_}`)
    // map using async function
    .map( async value => value * 10)
    .log( _ => `${_}`)
    .value([2,4,6,8])
    .map( AsyncProcess.of().value( _ => _ * 20).rollback( async ctx => {
      console.log('rollback of value ', ctx.value)
     }))
    .log( _ => `${_}`)
}

user_test().start()
