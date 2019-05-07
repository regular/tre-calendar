const pull = require('pull-stream')
const test = require('tape')
const merge = require('pull-merge')
const Source = require('tre-dates/source')
const compare = require('../compare-dates')

const source = Source({})

function msg(date, time, name, recurrence) {
  const revisionRoot = '%' + name
  return {
    value: {
      content: {
        type: 'date',
        date, time, name, recurrence,
        revisionRoot
      }
    }
  }
}

test('merge daily dates', t=>{
  const daily = msg(
    '1901-02-03',
    '00:01',
    'daily',
    'skip +n day|set name daily-%n'
  )
  const midnight = msg(
    '1901-02-03',
    null,
    'midnight',
    'skip +n day|set name midnight-%n'
  )
  pull(
    merge([
      source(daily)().source,
      source(midnight)().source
    ], compare),
    pull.take(5),
    pull.collect( (err, result) => {
      t.error(err)
      t.equal(result.length, 5)
      t.deepEqual(result[0], {
        date: '1901-02-03',
        time: null,
        name: 'midnight-0',
        revisionRoot: '%midnight'
      })
      t.deepEqual(result[1], {
        date: '1901-02-03',
        time: '00:01',
        name: 'daily-0',
        revisionRoot: '%daily'
      })
      t.deepEqual(result.map(r=>r.name), [
        'midnight-0',
        'daily-0',
        'midnight-1',
        'daily-1',
        'midnight-2'
      ])
      t.end()
    })
  )
})

test('merge single dates', t=>{
  const one = msg(
    '1901-02-03',
    null,
    'one'
  )
  const two = msg(
    '1900-02-03',
    null,
    'two'
  )
  pull(
    merge([
      source(one)().source,
      source(two)().source
    ], compare),
    pull.collect( (err, result) => {
      t.error(err)
      t.equal(result.length, 2)
      t.deepEqual(result[0], {
        date: '1900-02-03',
        time: null,
        name: 'two',
        revisionRoot: '%two'
      })
      t.deepEqual(result[1], {
        date: '1901-02-03',
        time: null,
        name: 'one',
        revisionRoot: '%one'
      })
      t.end()
    })
  )
})


