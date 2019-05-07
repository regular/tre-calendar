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
const collectMutations = require('collect-mutations')
const pull = require('pull-stream')
const WatchMerged = require('tre-prototypes')
const merge = require('pull-merge')
const compareDates = require('./compare-dates')
//const formatDate = require('tre-dates/format')
const dayjs = require('dayjs').extend(require('dayjs/plugin/localizedFormat'))

module.exports = function(ssb) {
  const getSourceObs = Source(ssb)
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

    const source = computed(mergedDates, kvs => {
      console.log('kvs', kvs)
      if (!kvs.length) return {source: pull.empty()}
      const sourcesObs = kvs.map(kv => getSourceObs(kv, {}))
      return computed(sourcesObs, function() {
        const sources = Array.from(arguments).map(s => s.source())
        return {source: merge(sources, compareDates)}
      })
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
        const formattedSource = pull(
          source,
          (()=>{
            let my, d
            return pull.map(
              ({date, time, name})=>{
                const dj = dayjs(date)
                let month_year = dj.format('MMMM YYYY')
                let day = dj.format('dddd, D')
                if (month_year == my) month_year = ''; else my = month_year
                if (day == d) day = ''; else d = day
                
                const ret = [
                  h(`span.name${time ? '' : '.all-day'}`, name)
                ]
                if (time) ret.unshift(
                  h('span.time', time)
                )
                if (day) ret.unshift(
                  h('span.day', day)
                )
                if (month_year) ret.unshift(
                  h('span.month-year', month_year)
                )
                return ret
              }
            )
          })()
        )
        return List(formattedSource, null, x => x)
      })
    ])
  }
}

// -- utils

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
