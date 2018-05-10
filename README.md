# AsyncProcess

Simple usage

```javascript
  const process = AsyncProcess.of([1,2,3])
    .map( _ => _ * 2)
    .forEach( _ => {
      console.log(_)
    })
  // then at some point
  process.start()
```