import { AsyncProcess, AsyncProcessCtx } from './AsyncProcess'

// promisified sleep for testing...
function sleep (ms:number) : Promise<any> {
  return new Promise( (r) => {
    setTimeout(r, ms)
  })
}

const findUser = AsyncProcess.of()
  .code( async ctx => {
    const id = ctx.value
    console.log(`Fetching user ${id} from database :)`)
    await sleep(1000)
    return {
      id : id,
      name : `user ${id}`
    }  
  })
  .rollback( async ctx => {
    console.log('could rollback the user op for ', ctx.value)
  })

function user_test() : AsyncProcess {
  return AsyncProcess.of([1,2,3])
    .map(findUser) // fetch users from DB using function or process
    .value( _ => {
      // Do whatever you want with the values...
    })
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

function simple_test() : AsyncProcess {
  const mapper = AsyncProcess.of().value( _ => _ * 15)
  const show_slowly = AsyncProcess.of()
    .log( _ => _ )
    .sleep(1000)
  const process = AsyncProcess.of([1,2,3])
    .map(mapper)
    .forEach(show_slowly)
    .rollback( async ctx => {
      // ctx.value has the process resolved value
    })
  return process
}

AsyncProcess.of()
  .add( user_test() )
  .add( simple_test() )
  .start()

