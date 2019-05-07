function dts(d) {
  const r = `${d.date} ${d.time||'00:00'} ${d.revisionRoot}`
  return r
}

module.exports = function compareDates(a,b) {
  a = dts(a)
  b = dts(b)
  let ret=0
  if (a < b) ret =  -1
  if (a > b) ret = 1
  console.log(ret, a, b)
  return ret
}
