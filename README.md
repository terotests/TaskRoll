# TaskRoll

Simple usage

```javascript
  const mapper = TaskRoll.of().value( _ => _ * 15)
  const show_slowly = TaskRoll.of()
    .log( _ => _ )
    .sleep(1000)
  const task = TaskRoll.of([1,2,3])
    .map(mapper)
    .forEach(show_slowly)
    .rollback( async ctx => {
      // ctx.value has the process resolved value
    })
  // evaluate when needed
  task.start()
```

# Related projects

https://github.com/gcanti/io-ts
