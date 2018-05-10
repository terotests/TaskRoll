
export enum AsyncProcessType {
  Sequential = 1,
  Parallel,
  Race,
  Loop,
  Catch,
  Background,
}

type cleanupFnWithCtx = (ctx?:AsyncProcessCtx) => Promise<void>
type cleanupFnWithoutCtx = () => Promise<void>
type cleanupFn = cleanupFnWithCtx 
type AnyFunction = (item:any) => any
type readyFnHandler = (ctx?:AsyncProcessCtx) => any

interface ProcessCallbacks {
  onCleanup? : cleanupFn
  onCancel? : cleanupFn
  executeTask? : (ctx:AsyncProcessCtx) => any
  name? : string
}

type AsyncProcessFn = () => AsyncProcess

export enum AsyncProcessState {
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

export class AsyncProcessCtx {
  value:any;
  parent:AsyncProcess;
  task:AsyncProcess;
  thread:AsyncProcess;
  params:any;
  state:Object

  serialize () : Object {
    const s = {}
    Object.keys(this.state).forEach( key => {
      if(! ( this.state[key] instanceof AsyncProcess) ) {
        s[key] = this.state[key] 
      }
    })
    return {
      value : this.value,
      state : s,
    }
  }
  constructor(value?:any, parent?:AsyncProcess, params?:any, task?:AsyncProcess) {
    this.value = value
    this.parent = parent;
    this.params = params;
    this.task = task;
    this.state = {}
  }
  _copy() : AsyncProcessCtx {
    const n = new AsyncProcessCtx()
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

  reduceState( value:any ) : AsyncProcessCtx {
    const o = this._copy()
    o.state = {
      ...this.state,
      ...value
    }
    return o
  }   
  setState( name:string, value:any ) : AsyncProcessCtx {
    const o = this._copy()
    o.state = {
      ...this.state,
      [name] : value
    }
    return o
  }   
  setThread( thread:AsyncProcess ) : AsyncProcessCtx {
    const o = this._copy()
    o.thread = thread
    return o
  }  
  setTask( task:AsyncProcess ) : AsyncProcessCtx {
    const o = this._copy()
    o.task = task
    return o
  }
  setValue( value:any ) : AsyncProcessCtx {
    const o = this._copy()
    o.value = value
    return o
  }
  setParent( parent:AsyncProcess ) : AsyncProcessCtx {
    const o = this._copy()
    o.parent = parent
    return o
  }
  setParams( params:any ) : AsyncProcessCtx {
    const o = this._copy()
    o.params = params
    return o
  }
  resolve( value? : any ) {
    if( value instanceof AsyncProcessCtx ) {
      this.parent.resolve( value )
      return
    }
    if( typeof(value) != 'undefined') {
      this.parent.resolve( this.setValue( value ) )
    } else {
      this.parent.resolve( this )
    }
  }
  reject( ) {
    this.parent.reject( this )
  }  
}


export class AsyncProcess {

  index:number = -1;
  type:AsyncProcessType = AsyncProcessType.Sequential
  state:AsyncProcessState = AsyncProcessState.Begin
  
  children:Array<AsyncProcess>;
  spawned:Array<AsyncProcess>;
  ctx:AsyncProcessCtx
  result:AsyncProcessCtx

  onFulfilledHandlers:Array<readyFnHandler>

  next:AsyncProcess
  prev:AsyncProcess

  closeAtEnd:boolean = false
  shutdown:boolean = false
  isolated:boolean = false
  committed:boolean = false

  name:string = ''

  onCancel : cleanupFn
  onCleanup : cleanupFn

  constructor(cbs?:ProcessCallbacks) {
    this.children = []
    this.spawned = []
    this.onFulfilledHandlers = []
    this.type = AsyncProcessType.Sequential
    this.result = new AsyncProcessCtx()
    if(cbs) {
      this.executeTask = cbs.executeTask || this.executeTask
      this.onCleanup = cbs.onCleanup || this.onCleanup
      this.onCancel = cbs.onCancel || this.onCancel
      this.name = cbs.name || this.name
    }
  }

  static of(value?:any) : AsyncProcess {
    const p = new AsyncProcess({name:'of'});
    if(typeof value === 'undefined') return p
    return p.value( value ) 
  }

  clone () : AsyncProcess {
    const c = new AsyncProcess()
    c.type = this.type
    c.children = this.children.map( c => c.clone() )
    c.isolated = this.isolated
    c.name = this.name
    c.executeTask = this.executeTask
    c.onCancel = this.onCancel
    c.onCleanup = this.onCleanup
    return c
  }

  commit () : AsyncProcess {
    this.committed = true
    return this
  }

  log( msg : string | AnyFunction) : AsyncProcess {
    return this.code( _ => {
      if(typeof(msg) === 'function') {
        console.log( msg( _.value ) )
      } else {
        console.log(msg) 
      }
    }, 'log')
  }

  sleep( ms : number) : AsyncProcess {
    return this.code( async _ => {
      await sleep(ms)
    }, 'sleep')
  }

  add( o : AsyncProcess ) : AsyncProcess {
    this.children.push(o)
    return this;
  }   

  fork( build: (p:AsyncProcess) => void ) : AsyncProcess {
    const o = new AsyncProcess()
    o.isolated = true
    o.name = 'fork'
    build(o)
    this.children.push(o)
    return this;
  }    
  
  process( build: (p:AsyncProcess) => void ) : AsyncProcess {
    const o = new AsyncProcess()
    build(o)
    this.children.push(o)
    return this;
  }   

  valueFrom( name:string ) : AsyncProcess {
    this.children.push( new AsyncProcess({
      name : `valueFrom ${name}`,
      executeTask(c) {
        c.resolve( c.getState(name) )
      }
    }))
    return this
  }   

  valueTo( name:string ) : AsyncProcess {
    this.children.push( new AsyncProcess({
      name : `valueTo ${name}`,
      executeTask(c) {
        const newCtx = c.setState(name, c.value )
        c.parent.resolve( newCtx )
      }
    }))
    return this
  }  

  value( value : any | AnyFunction | AsyncProcess ) : AsyncProcess {
    if(typeof value === 'function') {
      const p = new AsyncProcess()
      p.code( ctx => value(ctx.value) )
      this.children.push(p)
      return this
    }     
    this.children.push( new AsyncProcess({
      name : `value`,
      executeTask(c) {
        if(typeof(value) == 'function') {
          c.resolve(value(c.value))
          return
        } 
        if( value instanceof AsyncProcess) {
          return value.clone()
        }
        c.resolve(value)
      }
    }))
    return this
  }   

  background( build: (p:AsyncProcess) => void ) : AsyncProcess {
    const o = new AsyncProcess()
    o.type = AsyncProcessType.Background
    build(o)
    this.children.push(o)
    return this;
  }   

  parallel( build: (p:AsyncProcess) => void ) : AsyncProcess {
    const o = new AsyncProcess()
    o.type = AsyncProcessType.Parallel
    build(o)
    this.children.push(o)
    return this;
  }   
  
  forEach ( fn : AnyFunction | AsyncProcessFn | AsyncProcess, name?:string ) : AsyncProcess {
    const o = new AsyncProcess();
    o.isolated = true
    o.name = 'forEach' + (name ? ' ' + name : '')
    o.executeTask = function( ctx:AsyncProcessCtx ) {
      const mapProcess = new AsyncProcess()
      mapProcess.isolated = true
      if(typeof fn === 'function') {
        return mapProcess.value(ctx.value).code( ctx => {
          return Promise.all( ctx.value.map(fn) )          
          // return ctx.value.map(fn)
        })
      }      
      return AsyncProcess.of(ctx.value)
        .fork( p  => {
          for( let value of ctx.value) {
            p.call(fn, value)
          }
        })
    }
    this.children.push(o)    
    return this
  }

  cleanup( fn:cleanupFnWithCtx ) : AsyncProcess {
    this.onCleanup = fn
    return this
  }
  
  rollback( fn:cleanupFnWithCtx ) : AsyncProcess {
    this.onCancel = fn
    return this
  }

  map ( fn : AnyFunction | AsyncProcessFn | AsyncProcess | any ) : AsyncProcess {
    const o = new AsyncProcess();
    o.name = 'map'
    o.executeTask = function( ctx:AsyncProcessCtx ) {      
      if(typeof fn === 'function') {
        return AsyncProcess.of(ctx.value).code( ctx => {
          return Promise.all( ctx.value.map(fn) )
        })
      }
      if(fn instanceof AsyncProcess) {
        o.name = o.name + ' ' + ( fn.name || '')
      }
      return AsyncProcess.of(ctx.value)
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

  code( fn :(ctx:AsyncProcessCtx) => any, name? :string ) : AsyncProcess {
    const o = new AsyncProcess();
    o.setName(  name || 'code' )
    o.executeTask = function( ctx:AsyncProcessCtx ) {
      try {
        const new_value = fn( ctx )
        if( new_value instanceof AsyncProcess) {
          return new_value
        }
        // resolve promise from code
        if( new_value && new_value.then) {
          new_value.then( _ => ctx.resolve(_) )
          return;
        }
        if( typeof(new_value) != 'undefined' ) {
          ctx.resolve( new_value )
        } else {
          ctx.parent.resolve( ctx )
        }
      } catch(e) {
        console.error(e)
        ctx.parent.reject(ctx)
      }
    }
    this.children.push(o)
    return this;
  }  
  
  fn( name:string, fnCode:AsyncProcess ) : AsyncProcess {
    this.code( ctx => {
      // should be using the scope
      ctx.resolve( ctx.setState(name, fnCode) )
    },`fn: ${name}`)
    return this
  }
  
  setName( name : string | any) : AsyncProcess{
    if(typeof(name) == 'string') this.name = name
    if( name instanceof AsyncProcess) this.name = name.name
    return this
  }

  // TODO: handle call 
  call( name:string | any, givenParams? : AnyFunction | any ) : AsyncProcess {
    this.code( ctx => {
      let fn:AsyncProcess;
      let params = givenParams

      if( typeof name == 'string') fn = ctx.getState(name)
      if( name instanceof AsyncProcess) fn = name.clone();
      if( params instanceof AsyncProcess) params = givenParams.clone();      
      if( typeof name == 'function') {
        return AsyncProcess.of(params).value( _ => name(_))
      }            
      if(typeof params === 'function') {
        return AsyncProcess.of().code( _ => {
          return params( ctx.value )
        }, name).setName(name).add( fn.clone() )
      }
      if(typeof params !== 'undefined') {
        return AsyncProcess.of( params ).setName(name).add( fn.clone() )
      }
      return fn.clone().setName(name)
    }, `${name.name || name}()`)
    return this
  }

  resolve(ctx:AsyncProcessCtx) {
    // can not resolve many times
    if(ctx.task.state == AsyncProcessState.Resolved || ctx.task.state == AsyncProcessState.Rejected) {
      return      
    }
    if(this.state != AsyncProcessState.Running) {
      return;
    }
    ctx.task.state = AsyncProcessState.Resolved
    // The result is for both the thread and the task where it was spawned from 
    ctx.thread.result = ctx
    ctx.task.result = ctx;
    this.result = ctx;
    try {
      if(ctx.task.onCleanup) ctx.task.onCleanup(ctx)
    } catch(e) {
      this.endWithError(ctx)
      return
    }
    const parallels_exited = ( key:string, task?:AsyncProcess ) => {
      if(!task) return true
      if(task.type != AsyncProcessType.Parallel) return true
      if(task.type == AsyncProcessType.Parallel && task.state == AsyncProcessState.Running) return false
      return parallels_exited( key, task[key] )
    }
    if(ctx.task) {
      if(ctx.task.type == AsyncProcessType.Parallel) {
        if( parallels_exited('prev', ctx.task) &&  parallels_exited('next', ctx.task)  ) {
          this.step(ctx) 
        }
        return
      }
      // step only if this is the last active task
      if(this.children.indexOf(ctx.task) == this.index) {
        this.step(ctx)    
      }
    } 
  }

  reject(ctx:AsyncProcessCtx) {
    if(ctx.task.state !== AsyncProcessState.Running) {
      return
    }
    this.endWithError(ctx)
  }

  _start(ctx:AsyncProcessCtx) {    
    if(this.state !== AsyncProcessState.Begin) return
    this.index = -1;
    this.state = AsyncProcessState.Running
    this.children.forEach( (item, index) => {
      item.next = this.children[index + 1]
      item.prev = index > 0 ? this.children[index - 1] : null
    })
    this.step(this.ctx)
  }

  run (ctx?:AsyncProcessCtx) {
    this.ctx = ctx || new AsyncProcessCtx();
    this._start(this.ctx)
  }

  reset (ctx:AsyncProcessCtx) {
    this.index = -1
    this.state = AsyncProcessState.Begin
    this.shutdown = false
    this.spawned = []
    this.children.forEach( ch => {
      ch.state = AsyncProcessState.Begin
      ch.reset(ctx)
    })
  }  

  executeTask( ctx:AsyncProcessCtx ) : AsyncProcess | undefined | void {
    if(this.state === AsyncProcessState.Resolved) {
      // TODO: how to use already resolved value like promises do
      return
    }
    if(this.state === AsyncProcessState.Rejected) return
    this.state = AsyncProcessState.Begin
    this.run(ctx)
  }    
  
  step( ctx:AsyncProcessCtx ) {

    if(this.state !== AsyncProcessState.Running) {
      return
    }
    if( ( this.index + 1 ) >= this.children.length) {
      if( this.type == AsyncProcessType.Background ) {
        this.state = AsyncProcessState.Begin
        this.reset( this.ctx )
        this.run( this.ctx )
        return;
      }      
      // this.state = AsyncProcessState.Resolved
      process.nextTick( _ => {
        this.endGracefully( ctx )
      })
      return
    }
    const nextTask = this.children[this.index + 1]
    if(!nextTask || nextTask.state !== AsyncProcessState.Begin) {
      // if the task was resolved return the resolved value
      if(nextTask.state == AsyncProcessState.Resolved) {
        process.nextTick( _ => {
          ctx.resolve( nextTask.result.value)
        });
      }      
      return
    } 
    this.index = this.index + 1;
    nextTask.state = AsyncProcessState.Running

    const resolve_task = ( nextTask:AsyncProcess ) => {
      nextTask.state = AsyncProcessState.Running
      let anotherTask = nextTask.executeTask( ctx.setParent( this ).setTask( nextTask ).setThread( nextTask) )
      while(anotherTask) {
        anotherTask.state = AsyncProcessState.Running
        nextTask.spawned.push( anotherTask )
        anotherTask = anotherTask.executeTask( ctx.setParent( this ).setTask( nextTask ).setThread( anotherTask) )
      }            
    }
    switch(nextTask.type) {
      case AsyncProcessType.Sequential:
        process.nextTick( _ => {
          try {
            resolve_task( nextTask )
          } catch(e) {
            console.error(e)
            this.endWithError(ctx)
          }
        })
        break;
      case AsyncProcessType.Background:
        process.nextTick( _ => {
          try {
            resolve_task( nextTask )
            this.step(ctx)
          } catch(e) {
            console.error(e)
            this.endWithError(ctx)
          }
        })        
         break;
      case AsyncProcessType.Parallel:
          // start taxk and move forward
          const idx = this.index;
          process.nextTick( _ => {
            try {
              resolve_task( nextTask )
              const peekTask = this.children[idx + 1]
              if(peekTask && peekTask.type == AsyncProcessType.Parallel) {
                this.step(ctx)
              }
              if(!peekTask) this.step(ctx)
            } catch(e) {
              console.error(e)
              this.endWithError(ctx)
            }
          })
        break;
    }    
  }

  async stopChildren( state : AsyncProcessState ) {
    if(this.committed) return;
    // close any running process
    const stop_task = async (ch) => {
      if(ch.committed) return
      if(ch.state == AsyncProcessState.Running) {
        await ch.stopChildren(state)
        try {
          if(ch.onCleanup) await ch.onCleanup(ch.result)        
          if(ch.onCancel) await ch.onCancel(ch.result)
        } catch(e) {

        }
        ch.state = state
      } else {
        if(ch.state != AsyncProcessState.Begin) {
          await ch.stopChildren(state)
          if( ch.state != AsyncProcessState.Rejected && ch.onCancel) await ch.onCancel(ch.result)
          ch.state = state
        }   
      }
    }
    const list = this.children.slice().reverse()
    for( let ch of list ) {
      const spawned = ch.spawned.slice().reverse()
      for( let spwn of spawned ) {
        await stop_task(spwn)
      }
      await stop_task(ch)
    }    
  }

  async cleanChildren( state : AsyncProcessState ) {
    const list = this.children.slice().reverse()
    const clean_task = async (ch) => {
      if(ch.state == AsyncProcessState.Running) {
        await ch.cleanChildren(state)
        try {
          if(ch.onCleanup) await ch.onCleanup(ch.result)
        } catch(e) {
          // TODO: what to do if cleanup fails ? 
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

  onFulfilled( fn:readyFnHandler) {
    // if ready, return immediately
    if(this.state == AsyncProcessState.Resolved || this.state == AsyncProcessState.Rejected) {
      fn(this.ctx)
      return
    }    
    this.onFulfilledHandlers.push(fn)
  }
  
  async endGracefully(ctx:AsyncProcessCtx) {
    
    // console.log("Process AsyncProcessState.Resolved")
    if(this.closeAtEnd) {
      await this.stopChildren( AsyncProcessState.Resolved  )
    } else {
      await this.cleanChildren( AsyncProcessState.Resolved  )
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
    this.state = AsyncProcessState.Resolved
    if(this.onCleanup) this.onCleanup(this.result)
    this.onFulfilledHandlers.forEach( fn => fn(this.ctx))
  }
  async endWithError(ctx:AsyncProcessCtx) {

    if(this.shutdown) {
      // wait until state become shutdown
      while(this.shutdown) {
        await sleep(100)
      }
      return;
    }   
    if( this.state == AsyncProcessState.Rejected ) {
      return
    }

    // find the uppermost parent to shut down...
    if(this.ctx.parent) {
      this.ctx.parent.endWithError( this.ctx.parent.ctx )
      return
    }    
    this.shutdown = true
    await this.stopChildren( AsyncProcessState.Rejected )
    try {
      if( this.onCancel && !this.committed ) this.onCancel(this.result)   
    } catch(e) {
      // if onCancel fails there could be trouble, should be noted somehow
    }
    this.shutdown = false
    this.state = AsyncProcessState.Rejected
    this.onFulfilledHandlers.forEach( fn => fn(this.ctx))

  }

  serialize() : Object {
    const walk_process = (p:AsyncProcess) : Object => {
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

  start( ctx?:AsyncProcessCtx) {
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
    this.ctx = ctx || new AsyncProcessCtx();
    this.closeAtEnd = true
    this._start(this.ctx)
  }
  
}
