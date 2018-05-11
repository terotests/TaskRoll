# TaskRoll

https://www.npmjs.com/package/taskroll

```
npm i taskroll
```

Creates lazily evaluated tasks, which calcualate asyncronouse tasks in syncronous manner. Tasks can be composed like Promises or Futures. Main features: 

- Lazy evaluation
- Stack safety
- Continuation guarding
- Cancellation support with syncronous reversed rollback
- Catches exceptions. 
- Inspectable immutable context after each computation
- Supports functions returning promises
- Holds state which can hold data or callable Tasks

```javascript
  const mapper = TaskRoll.of().value( _ => _ * 15)
  const show_slowly = TaskRoll.of()
    .log( _ => _ )
    .sleep(1000)
  const task = TaskRoll.of()
    .map(mapper)
    .forEach(show_slowly)

  TaskRoll.of([1,2,3,4]).chain(task).start()
  // 15
  // 30
  // 45
  // 60

```

## .of(value:any)

Transform any value into Task

```javascript
TaskRoll.of([1,2,3,4]).forEach( _ => {
  console.log(_)
}).start()
```

## .start()

Starts execution of Task - task will not start without calling start. 

```javascript
TaskRoll.of().log('Hello World').start()
```

## .chain( (value:any) => any )

```javascript
const multiply = TaskRoll.of().chain( _ => _ * 2)
```

Result of the `chain` can also be another `Task` which is evaluated

```javascript
TaskRoll.of(1).chain( _ => {
  return TaskRoll.of( _ + 1)
}) // 2
```

## .value( value?:any)

Sets the value, alias to `chain`
```javascript
TaskRoll.of(4).value(6).log( _ => _ ) // 6
```

## .map( (value:any) => any )

```javascript
const multiply = TaskRoll.of().chain( _ => _ * 2)
TaskRoll.of([1,2,3]).map( multiply )
```

## .forEach( (value:any) => any )

```javascript
TaskRoll.of([1,2,3]).forEach( _ => {
  console.log(_)
})
```

## .fn( name:string, value?:any)

Create Task based function in state. Can be used to signal events.

```javascript
const multiply = TaskRoll.of().chain( _ => _ * 2)
const lazyvalue = TaskRoll.of(100)
TaskRoll.of().fn('multiply', multiply)
  .value(11)
  .call('multiply') // 22
  .call('multiply', lazyvalue) // 200
  .call(multiply, lazyvalue)   // 200
```

## .call( fn:TaskRoll, value?:any)

Apply Task to the value programmatically

```javascript
const multiply = TaskRoll.of().chain( _ => _ * 2)
const slowValue = TaskRoll.of(10).sleep(1000)

TaskRoll.of(4).call(multiply)           // 8
TaskRoll.of().call(multiply,3)          // 6
TaskRoll.of().call(multiply,slowValue)  // 20

```

## .valueTo( string )

```javascript
TaskRoll.of(5).valueTo('x')   // ctx.state.x == 5
```
## .valueFrom( string )

```javascript
TaskRoll.of().valueFrom('x')   // ctx.value == 5
```

## .fork( (task:TaskRoll) => any )

In case we want to use the current value for something but preseve original we can
fork the execution.

```javascript
TaskRoll.of(5)
  .fork( task => {
    task.chain( _ => _ * 10 ) // 50
      .log( _ => _)
  })
  .log( _ => _) // still 5 here
```

## .background( (task:TaskRoll) => any )

Execute repeating task at background

```javascript
TaskRoll.of(...).background( task => {
  task.log('msg from bg').sleep(1000)
})
```

## .cleanup( async fn => any )

Cleanup after task completes successfully or not.

```javascript
TaskRoll.of(...)
  .chain(doSomething)
  .cleanup( async (ctx:TaskRollCtx) => {
    // ctx.value
    // ctx.state
  })
```

## .rollback( async fn => any )

If task is cancelled (not committed)

```javascript
TaskRoll.of(...)
  .chain(doSomething)
  .rollback( async  (ctx:TaskRollCtx) => {
    // ctx.value
    // ctx.state
  })
```

## .setName( string)

```javascript
TaskRoll.of('Hello World').setName('Hello World Process')
```

## .log( string | (value:any) => string )

```javascript
TaskRoll.of('Hello World').log( _ => `${_}`)
```

## .serialize() => Object 

```javascript
const obj = TaskRoll.of().serialize()
```

## .sleep( number )

```javascript
TaskRoll.of().log('sleeping 1 sec').sleep(1000).log('awake')
```

## .commit()

Accept changes (rollback is not called)

```javascript
TaskRoll.of([1,2,3])
  .map(doSomething)
  .commit() 
```

## .onFulfilled( (ctx:TaskRollCtx) => void )

Called when task ends


# Related projects

Projects which are solving similar problems

- https://github.com/fluture-js/Fluture
- https://github.com/gcanti/io-ts
