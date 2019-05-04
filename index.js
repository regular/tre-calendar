const Fields = require('tre-field-observer')
const Str = require('tre-string')
const h = require('mutant/html-element')
const computed = require('mutant/computed')
const MutantArray = require('mutant/array')
const MutantMap = require('mutant/map')
const Value = require('mutant/computed')
const List = require('tre-endless-list')
const Source = require('tre-dates/source')
const styles = require('module-styles')('tre-dates')
const dayjs = require('dayjs')
const collectMutations = require('collect-mutations')
const pull = require('pull-stream')
const WatchMerged = require('tre-prototypes')
const merge = require('pull-merge')

module.exports = function(ssb) {
  const dateSource = Source(ssb)
  const watchMerged = WatchMerged(ssb)

  return function(kv, ctx) {
    if (kv.value.content.type !== 'calendar') return
    const fields = Fields(ssb)(kv, ctx)
    const contentObs = ctx.contentObs || Value({})
    function set(o) {
      contentObs.set(Object.assign({}, contentObs(), o))
    }
    const renderStr = Str({
      save: name => set({name})
    })

    const dates = MutantArray()
    // TODO: move this into a module
    const mergedDates = MutantMap(dates, headObs => {
      return watchMerged(headObs, {
        allowAllAuthors: true,
        suppressIntermediate: true
      })
    }, {comparer: kvcomp})

    const sources = MutantMap(mergedDates, kvObs => {
      console.log('kvObs', kvObs())
      return computed(kvObs, kv =>{
        return dateSource(kv, {})
      })
    })

    const source = computed(sources, sources =>{
      if (!sources.length) return {source: pull.empty()}
      return {source: merge(sources.map( ({source}) => source), compareDates)}
    })

    const drain = collectMutations(dates, {sync: true})
    pull(
      ssb.revisions.messagesByBranch(revisionRoot(kv), {live: true, sync: true}),
      drain
    )

    function abort() {
      drain.abort()
    }

    return h('.tre-calendar', {
      hooks: [el => abort],
    }, [
      renderStr(fields.get('name', 'no name')),
      computed(source, ({source}) => {
        return List(source, null, ({date, name}) => {
          return h('li', `${date} ${name}`)
        })
      })
    ])
  }
}

// -- utils

function dts(a) {
  d = a.date.replace(/^..., /, '')
  return `${d}${a.name}`
}

function compareDates(a,b) {
  if (dts(a) < dts(b)) return -1
  return 1
}

function kvcomp(a,b) {
  a = typeof a == 'function' ? a() : a
  b = typeof b == 'function' ? b() : b
  //console.log(a, '==', b)
  if (!a && !b) return true
  const ak = a && a.key
  const bk = b && b.key
  return ak == bk
}

function revisionRoot(kv) {
  return (kv && kv.value.content.revisionRoot) || kv.key
}
