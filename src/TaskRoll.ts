
export enum TaskRollType {
  Sequential = 1,
  Parallel,
  Race,
  Loop,
  Catch,
  Background,
}

export type cleanupFnWithCtx = (ctx?:TaskRollCtx) => Promise<void>
export type cleanupFnWithoutCtx = () => Promise<void>
export type cleanupFn = cleanupFnWithCtx 
export type AnyFunction = (item:any) => any
export type readyFnHandler = (ctx?:TaskRollCtx) => any

export interface ProcessCallbacks {
  onCleanup? : cleanupFn
  onCancel? : cleanupFn
  executeTask? : (ctx:TaskRollCtx) => any
  name? : string
}

export type TaskRollFn = () => TaskRoll

export enum TaskRollState {
  Begin = 1,
  Pending,
  Running,
  Cancelled,
  Resolved,
  Rejected  
}

function sleep (ms:number) : Promise<any> {
  return new Promise( (r) => {
    setTimeout(r, ms)
  })
}

export class TaskRollCtx {
  value:any;
  parent:TaskRoll;
  task:TaskRoll;
  thread:TaskRoll;
  params:any;
  state:any

  serialize () : Object {
    const s = {}
    Object.keys(this.state).forEach( key => {
      if(! ( this.state[key] instanceof TaskRoll) ) {
        s[key] = this.state[key] 
      }
    })
    return {
      value : this.value,
      state : s,
    }
  }
  constructor(value?:any, parent?:TaskRoll, params?:any, task?:TaskRoll) {
    this.value = value
    this.parent = parent;
    this.params = params;
    this.task = task;
    this.state = {}
  }
  _copy() : TaskRollCtx {
    const n = new TaskRollCtx()
    n.value = this.value
    n.parent = this.parent
    n.task = this.task
    n.params = this.params
    n.thread = this.thread
    n.state = this.state
    return n
  }
  getState( name:string ) : any {
    return this.state[name]
  }   

  reduceState( value:any ) : TaskRollCtx {
    const o = this._copy()
    o.state = {
      ...this.state,
      ...value
    }
    return o
  }   
  setState( name:string, value:any ) : TaskRollCtx {
    const o = this._copy()
    o.state = {
      ...this.state,
      [name] : value
    }
    return o
  }   
  setThread( thread:TaskRoll ) : TaskRollCtx {
    const o = this._copy()
    o.thread = thread
    return o
  }  
  setTask( task:TaskRoll ) : TaskRollCtx {
    const o = this._copy()
    o.task = task
    return o
  }
  setValue( value:any ) : TaskRollCtx {
    const o = this._copy()
    o.value = value
    return o
  }
  setParent( parent:TaskRoll ) : TaskRollCtx {
    const o = this._copy()
    o.parent = parent
    return o
  }
  setParams( params:any ) : TaskRollCtx {
    const o = this._copy()
    o.params = params
    return o
  }
  resolve( value? : any ) {
    if( value instanceof TaskRollCtx ) {
      this.parent.resolve( value )
      return
    }
    if( typeof(value) != 'undefined') {
      this.parent.resolve( this.setValue( value ) )
    } else {
      this.parent.resolve( this )
    }
  }
  reject( value? : any) {
    if( typeof(value) != 'undefined') {
      this.parent.reject( this.setValue( value ) )
    } else {
      this.parent.reject( this )
    }
  }  
}


export default class TaskRoll {

  index:number = -1;
  taskIndex:number = 0;
  type:TaskRollType = TaskRollType.Sequential
  state:TaskRollState = TaskRollState.Begin
  
  children:Array<TaskRoll>;
  spawned:Array<TaskRoll>;
  ctx:TaskRollCtx
  result:TaskRollCtx

  onFulfilledHandlers:Array<readyFnHandler>

  next:TaskRoll
  prev:TaskRoll

  closeAtEnd:boolean = false
  shutdown:boolean = false
  isolated:boolean = false
  committed:boolean = false

  name:string = ''

  onCancel : cleanupFn = null
  onCleanup : cleanupFn = null

  constructor(cbs?:ProcessCallbacks) {
    this.children = []
    this.spawned = []
    this.onFulfilledHandlers = []
    this.type = TaskRollType.Sequential
    this.result = new TaskRollCtx()
    if(cbs) {
      this.executeTask = cbs.executeTask || this.executeTask
      this.onCleanup = cbs.onCleanup || this.onCleanup
      this.onCancel = cbs.onCancel || this.onCancel
      this.name = cbs.name || this.name
    }
  }

  static of(value?:any) : TaskRoll {
    const p = new TaskRoll({name:'of'});
    if(typeof value === 'undefined') return p
    return p.value( value ) 
  }

  clone () : TaskRoll {
    const c = new TaskRoll()
    c.type = this.type
    c.children = this.children.map( c => c.clone() )
    c.isolated = this.isolated
    c.name = this.name
    c.executeTask = this.executeTask
    c.onCancel = this.onCancel
    c.onCleanup = this.onCleanup
    return c
  }

  commit () : TaskRoll {
    this.code( _ => {
      this.committed = true
    })
    return this
  }

  log( msg : string | AnyFunction) : TaskRoll {
    return this.code( _ => {
      if(typeof(msg) === 'function') {
        console.log( msg( _.value ) )
      } else {
        console.log(msg) 
      }
    }, 'log')
  }

  sleep( ms : number) : TaskRoll {
    return this.code( async _ => {
      await sleep(ms)
    }, 'sleep')
  }

  add( o : TaskRoll ) : TaskRoll {
    this.children.push(o)
    return this;
  }   

  fork( build: (p:TaskRoll) => void ) : TaskRoll {
    const o = new TaskRoll()
    o.isolated = true
    o.name = 'fork'
    build(o)   
    this.children.push(o)
    return this;
  }    
  
  process( build: (p:TaskRoll) => void ) : TaskRoll {
    const o = new TaskRoll()
    build(o)
    this.children.push(o)
    return this;
  }   

  valueFrom( name:string ) : TaskRoll {
    this.children.push( new TaskRoll({
      name : `valueFrom ${name}`,
      executeTask(c) {
        c.resolve( c.getState(name) )
      }
    }))
    return this
  }   

  valueTo( name:string ) : TaskRoll {
    this.children.push( new TaskRoll({
      name : `valueTo ${name}`,
      executeTask(c) {
        const newCtx = c.setState(name, c.value )
        c.parent.resolve( newCtx )
      }
    }))
    return this
  }  

  chain( value : any | AnyFunction | TaskRoll ) : TaskRoll {
    return this.value( value )
  }

  value( value : any | AnyFunction | TaskRoll ) : TaskRoll {
    if(typeof value === 'function') {
      const p = new TaskRoll()
      p.code( ctx => value(ctx.value))
      this.children.push(p)
      return this
    }     
    this.children.push( new TaskRoll({
      name : `value`,
      executeTask(c) {
        if(typeof(value) == 'function') {
          c.resolve(value(c.value))
          return
        } 
        if( value instanceof TaskRoll) {
          return value.clone()
        }
        c.resolve(value)
      }
    }))
    return this
  }   

  background( build: (p:TaskRoll) => void ) : TaskRoll {
    const o = new TaskRoll()
    o.type = TaskRollType.Background
    build(o)
    this.children.push(o)
    return this;
  }   

  parallel( build: (p:TaskRoll) => void ) : TaskRoll {
    const o = new TaskRoll()
    o.type = TaskRollType.Parallel
    build(o)
    this.children.push(o)
    return this;
  }   
  
  forEach ( fn : AnyFunction | TaskRollFn | TaskRoll, name?:string ) : TaskRoll {
    const o = new TaskRoll();
    o.isolated = true
    o.name = 'forEach' + (name ? ' ' + name : '')
    o.executeTask = function( ctx:TaskRollCtx ) {
      const mapProcess = new TaskRoll()
      mapProcess.isolated = true
      if(typeof fn === 'function') {
        return mapProcess.value(ctx.value).code( ctx => {
          return Promise.all( ctx.value.map(fn) )          
          // return ctx.value.map(fn)
        })
      }      
      return TaskRoll.of(ctx.value)
        .fork( p  => {
          for( let value of ctx.value) {
            p.call(fn, value)
          }
        })
    }
    this.children.push(o)    
    return this
  }

  cleanup( fn:cleanupFnWithCtx ) : TaskRoll {
    this.onCleanup = fn
    return this
  }
  
  rollback( fn:cleanupFnWithCtx ) : TaskRoll {
    this.onCancel = fn
    return this
  }

  cond(condition:AnyFunction | TaskRollFn | TaskRoll, fn : AnyFunction | TaskRollFn | TaskRoll | any, elseFn?:any) : TaskRoll {
    this.chain( originalValue => {
      return TaskRoll.of(originalValue).chain( condition ).chain( res => {
        if(!res) {
          if( typeof elseFn !== 'undefined') return TaskRoll.of( originalValue ).chain(elseFn)
          return originalValue
        }
        return TaskRoll.of( originalValue ).chain(fn)
      })
    }) 
    return this
  }

  map ( fn : AnyFunction | TaskRollFn | TaskRoll | any ) : TaskRoll {
    const o = new TaskRoll();
    o.name = 'map'
    o.executeTask = function( ctx:TaskRollCtx ) {      
      if(typeof fn === 'function') {
        return TaskRoll.of(ctx.value).code( ctx => {
          return Promise.all( ctx.value.map(fn) )
        })
      }
      if(fn instanceof TaskRoll) {
        o.name = o.name + ' ' + ( fn.name || '')
      }
      return TaskRoll.of(ctx.value)
        .process( p  => {
          const items = []
          for( let value of ctx.value) {
            p.call(fn, value)
            p.code( _ => {
              items.push( _.value )
            })
          }
          p.code( _ => {
            return items
          })
        })      
    }
    this.children.push(o)    
    return this
  }

  code( fn :(ctx:TaskRollCtx) => any, name? :string ) : TaskRoll {
    const o = new TaskRoll();
    o.setName(  name || 'code' )
    o.executeTask = function( ctx:TaskRollCtx ) {
      try {
        const new_value = fn( ctx )
        if( new_value instanceof TaskRoll) {
          return new_value
        }
        // resolve promise from code
        if( new_value && new_value.then) {
          new_value.then( _ => ctx.resolve(_), err => {
            ctx.reject(err)
          }).catch( err => {
            ctx.reject(err)
          })
          return;
        }
        if( typeof(new_value) != 'undefined' ) {
          ctx.resolve( new_value )
        } else {
          ctx.parent.resolve( ctx )
        }
      } catch(e) {
        ctx.reject(e)
      }
    }
    this.children.push(o)
    return this;
  }  
  
  fn( name:string, fnCode:TaskRoll ) : TaskRoll {
    this.code( ctx => {
      // should be using the scope
      ctx.resolve( ctx.setState(name, fnCode) )
    },`fn: ${name}`)
    return this
  }
  
  setName( name : string | any) : TaskRoll{
    if(typeof(name) == 'string') this.name = name
    if( name instanceof TaskRoll) this.name = name.name
    return this
  }

  // TODO: handle call 
  call( name:string | any, givenParams? : AnyFunction | any ) : TaskRoll {
    this.code( ctx => {
      let fn:TaskRoll;
      let params = givenParams

      if( typeof name == 'string') fn = ctx.getState(name)
      if( name instanceof TaskRoll) fn = name.clone();
      if( params instanceof TaskRoll) params = givenParams.clone();      
      if( typeof name == 'function') {
        return TaskRoll.of(params).value( _ => name(_))
      }            
      if(typeof params === 'function') {
        return TaskRoll.of().code( _ => {
          return params( ctx.value )
        }, name).setName(name).add( fn.clone() )
      }
      if(typeof params !== 'undefined') {
        return TaskRoll.of( params ).setName(name).add( fn.clone() )
      }
      return fn.clone().setName(name)
    }, `${name.name || name}()`)
    return this
  }

  resolve(ctx:TaskRollCtx) {
    // can not resolve many times
    if(ctx.task.state == TaskRollState.Resolved || ctx.task.state == TaskRollState.Rejected) {
      return      
    }
    if(this.state != TaskRollState.Running) {
      return;
    }
    ctx.task.state = TaskRollState.Resolved
    // The result is for both the thread and the task where it was spawned from 
    ctx.thread.result = ctx
    ctx.task.result = ctx;
    this.result = ctx;
    try {
      if(ctx.task.onCleanup) ctx.task.onCleanup(ctx)
    } catch(e) {
      this.endWithError(ctx.setValue(e))
      return
    }
    const parallels_exited = ( key:string, task?:TaskRoll ) => {
      if(!task) return true
      if(task.type != TaskRollType.Parallel) return true
      if(task.type == TaskRollType.Parallel && task.state == TaskRollState.Running) return false
      return parallels_exited( key, task[key] )
    }
    if(ctx.task) {
      if(ctx.task.type == TaskRollType.Parallel) {
        if( parallels_exited('prev', ctx.task) &&  parallels_exited('next', ctx.task)  ) {
          this.step(ctx) 
        }
        return
      }
      // step only if this is the last active task
      if(ctx.task.taskIndex == this.index) {
        this.step(ctx)    
      }
    } 
  }

  reject(ctx:TaskRollCtx) {
    // console.log('reject was called!')
    if(ctx && ctx.task && ctx.task.state !== TaskRollState.Running) {
      return
    }
    ctx.thread.result = ctx
    ctx.task.result = ctx;
    this.result = ctx;    
    if(this.ctx && this.ctx.parent) {
      this.ctx.parent.reject( ctx )
      return
    }    
    this.endWithError(ctx)
  }

  _start(ctx:TaskRollCtx) {    
    if(this.state !== TaskRollState.Begin) return
    this.index = -1;
    this.state = TaskRollState.Running
    this.children.forEach( (item, index) => {
      item.next = this.children[index + 1]
      item.prev = index > 0 ? this.children[index - 1] : null
      item.taskIndex = index
    })
    this.step(this.ctx)
  }

  run (ctx?:TaskRollCtx) {
    this.ctx = ctx || new TaskRollCtx();
    this._start(this.ctx)
  }

  reset (ctx:TaskRollCtx) {
    this.index = -1
    this.state = TaskRollState.Begin
    this.shutdown = false
    this.spawned = []
    this.children.forEach( ch => {
      ch.state = TaskRollState.Begin
      ch.reset(ctx)
    })
  }  

  executeTask( ctx:TaskRollCtx ) : TaskRoll | undefined | void {
    if(this.state === TaskRollState.Resolved) {
      // TODO: how to use already resolved value like promises do
      return
    }
    if(this.state === TaskRollState.Rejected) return
    this.state = TaskRollState.Begin
    this.run(ctx)
  }    
  
  step( ctx:TaskRollCtx ) {

    if(this.state !== TaskRollState.Running) {
      return
    }
    if( ( this.index + 1 ) >= this.children.length) {
      if( this.type == TaskRollType.Background ) {
        this.state = TaskRollState.Begin
        this.reset( this.ctx )
        this.run( this.ctx )
        return;
      }      
      setImmediate( _ => {
        this.endGracefully( ctx )
      })
      return
    }
    const nextTask = this.children[this.index + 1]
    if(!nextTask || nextTask.state !== TaskRollState.Begin) {
      // if the task was resolved return the resolved value
      if(nextTask.state == TaskRollState.Resolved) {
        setImmediate( _ => {
          ctx.resolve( nextTask.result.value)
        });
      }      
      return
    } 
    this.index = this.index + 1;
    nextTask.state = TaskRollState.Running

    const resolve_task = ( nextTask:TaskRoll ) => {
      nextTask.state = TaskRollState.Running
      let anotherTask = nextTask.executeTask( ctx.setParent( this ).setTask( nextTask ).setThread( nextTask) )
      while(anotherTask) {
        anotherTask.state = TaskRollState.Running
        nextTask.spawned.push( anotherTask )
        anotherTask = anotherTask.executeTask( ctx.setParent( this ).setTask( nextTask ).setThread( anotherTask) )
      }            
    }
    switch(nextTask.type) {
      case TaskRollType.Sequential:
        setImmediate( _ => {
          try {
            resolve_task( nextTask )
          } catch(e) {
            console.error(e)
            this.endWithError(ctx.setValue(e))
          }
        })
        break;
      case TaskRollType.Background:
        setImmediate( _ => {
          try {
            resolve_task( nextTask )
            this.step(ctx)
          } catch(e) {
            console.error(e)
            this.endWithError(ctx.setValue(e))
          }
        })        
         break;
      case TaskRollType.Parallel:
          // start taxk and move forward
          const idx = this.index;
          setImmediate( _ => {
            try {
              resolve_task( nextTask )
              const peekTask = this.children[idx + 1]
              if(peekTask && peekTask.type == TaskRollType.Parallel) {
                this.step(ctx)
              }
              if(!peekTask) this.step(ctx)
            } catch(e) {
              console.error(e)
              this.endWithError(ctx.setValue(e))
            }
          })
        break;
    }    
  }

  async stopChildren( state : TaskRollState ) {
    if(this.committed) return;
    const stop_task = async (ch) => {
      if(ch.committed) return
      if(ch.state == TaskRollState.Running) {
        await ch.stopChildren(state)
        try {
          if(ch.onCleanup) await ch.onCleanup(ch.result)        
          if(ch.onCancel) await ch.onCancel(ch.result)
        } catch(e) {
          console.error(e)
        }
        ch.state = state
      } else {
        if(ch.state != TaskRollState.Begin) {
          await ch.stopChildren(state)
          try {
            if( ch.state != TaskRollState.Rejected && ch.onCancel) await ch.onCancel(ch.result)
          } catch(e) {
            console.error(e)
          }
          ch.state = state
        }   
      }
    }
    try {
      const list = this.children.slice().reverse()
      for( let ch of list ) {
        const spawned = ch.spawned.slice().reverse()
        for( let spwn of spawned ) {
          await stop_task(spwn)
        }
        await stop_task(ch)
      }    
    } catch(e) {
      console.error(e)
    }
  }

  async cleanChildren( state : TaskRollState ) {
    const list = this.children.slice().reverse()
    const clean_task = async (ch) => {
      if(ch.state == TaskRollState.Running) {
        await ch.cleanChildren(state)
        try {
          if(ch.onCleanup) await ch.onCleanup(ch.result)
        } catch(e) {
          // TODO: what to do if cleanup fails ? 
          console.error(e)
        }
        ch.state = state
      }
    }
    for( let ch of list ) {
      const spawned = ch.spawned.slice().reverse()
      for( let spwn of spawned ) {
        await clean_task( spwn )
      }  
      await clean_task( ch )    
    }    
  }

  onFulfilled( fn:readyFnHandler) : TaskRoll {
    if(this.state == TaskRollState.Resolved || this.state == TaskRollState.Rejected) {
      fn(this.ctx)
      return
    }    
    this.onFulfilledHandlers.push(fn)
    return this
  }
  
  async endGracefully(ctx:TaskRollCtx) {
    
    if(this.closeAtEnd  && !this.committed) {      
      await this.stopChildren( TaskRollState.Resolved  )
    } else {
      await this.cleanChildren( TaskRollState.Resolved  )
    }
    if(this.ctx.parent) {
      // console.log("Does have parent")
      if(this.isolated) {
        // continue using the same value which was in the ctx previously
        this.ctx.parent.resolve( this.ctx.reduceState( ctx.state ) )
      } else {
        this.ctx.parent.resolve( this.ctx.setValue( ctx.value ).reduceState( ctx.state ) )
      }
    }
    this.state = TaskRollState.Resolved
    if(this.onCleanup) this.onCleanup(this.result)
    try {
      if(this.closeAtEnd && this.onCancel && !this.committed) this.onCancel(this.result)
    } catch(e) {
      console.error(e)
    }
    this.onFulfilledHandlers.forEach( fn => fn(this.result))  
  }
  async endWithError(ctx:TaskRollCtx) {
    try {
      if(this.shutdown) {
        // wait until state become shutdown
        while(this.shutdown) {
          await sleep(100)
        }
        return;
      }   
      if( this.state == TaskRollState.Rejected ) {
        return
      }
      // find the uppermost parent to shut down...
      if(this.ctx && this.ctx.parent) {
        this.ctx.parent.endWithError( ctx )
        return
      }    
      this.shutdown = true
      await this.stopChildren( TaskRollState.Rejected )
      if( this.onCancel && !this.committed ) this.onCancel(this.result)   
      this.shutdown = false
      this.state = TaskRollState.Rejected
      this.onFulfilledHandlers.forEach( fn => fn(this.result))
    } catch(e) {
      console.error(e)
    }
  }

  serialize() : Object {
    const walk_process = (p:TaskRoll) : Object => {
      return {
        name : p.name,
        initCtx : p.ctx && p.ctx.serialize() || null,
        resultCtx : p.result && p.result.serialize() || null,
        state : p.state,
        type : p.type,
        index : p.index,
        closeAtEnd : p.closeAtEnd,
        shutdown : p.shutdown,
        isolated : p.isolated,
        committed : p.committed,
        children : p.children.map(walk_process),
        spawned : p.spawned.map(walk_process)
      }
    }    
    return walk_process(this)
  }

  start( ctx?:TaskRollCtx) {
    // do not bind to node.js process automatically this time
    /*
    process.on('SIGINT', async () => {
      console.log("SIGINT")
      await this.endWithError(this.ctx)
      process.exit()
    });    
    process
      .on('unhandledRejection', async (reason, p) => {
        console.error(reason, 'Unhandled Rejection at Promise', p);
        await this.endWithError(this.ctx)
      })
      .on('uncaughtException', async err => {
        console.error(err, 'Uncaught Exception thrown');
        await this.endWithError(this.ctx)
        process.exit(1);
      });    
    */
    this.ctx = ctx || new TaskRollCtx();
    this.closeAtEnd = true
    this._start(this.ctx)
  }

  toPromise () : Promise<any> {
    return new Promise( (resolve, reject) => {
      this.onFulfilled( ctx => {
        if(this.state == TaskRollState.Resolved) {
          resolve(ctx.value)
          return
        }
        if(this.state == TaskRollState.Rejected) {
          reject(ctx.value)
          return
        }
        reject(ctx.value)
      })
      this.start()
    })
  }

}