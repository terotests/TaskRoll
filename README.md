# AsyncProcess

Simple usage

```javascript
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
  // then at some point
  process.start()
```